#!/usr/bin/env ruby
# LUMA Guide AI — Local HTTP & HTTPS Mobile Server
# Zero external dependencies. Uses Ruby standard library (WEBrick + OpenSSL).
# Serves both HTTPS (for full Mobile Camera, Mic & GPS permissions) and HTTP.

require 'webrick'
require 'webrick/https'
require 'openssl'
require 'socket'

# Determine local IP address
local_ip = Socket.ip_address_list.find do |addr|
  addr.ipv4? && !addr.ipv4_loopback? && !addr.ip_address.start_with?('169.254')
end&.ip_address || '127.0.0.1'

root = File.expand_path(__dir__)

# Helper to find an available port if default is occupied
def find_available_port(start_port)
  port = start_port
  while port < start_port + 20
    begin
      server = TCPServer.new('0.0.0.0', port)
      server.close
      return port
    rescue Errno::EADDRINUSE
      port += 1
    rescue => _
      return port
    end
  end
  start_port
end

# Generate self-signed certificate with proper Subject Alternative Names (SAN)
# Required by iOS Safari & Android Chrome to accept self-signed SSL for camera/mic
def generate_cert(local_ip)
  key = OpenSSL::PKey::RSA.new(2048)
  cert = OpenSSL::X509::Certificate.new
  cert.version = 2
  cert.serial = Time.now.to_i
  cert.subject = OpenSSL::X509::Name.parse("/CN=#{local_ip}")
  cert.issuer = cert.subject
  cert.public_key = key.public_key
  cert.not_before = Time.now - 3600
  cert.not_after = Time.now + 365 * 24 * 3600

  ef = OpenSSL::X509::ExtensionFactory.new
  ef.subject_certificate = cert
  ef.issuer_certificate = cert
  cert.add_extension(ef.create_extension('basicConstraints', 'CA:TRUE', true))
  cert.add_extension(ef.create_extension('keyUsage', 'digitalSignature,keyEncipherment', true))
  cert.add_extension(ef.create_extension('extendedKeyUsage', 'serverAuth'))
  cert.add_extension(ef.create_extension('subjectAltName', "IP:127.0.0.1,DNS:localhost,IP:#{local_ip},DNS:#{local_ip}"))
  cert.sign(key, OpenSSL::Digest::SHA256.new)

  [cert, key]
end

cert, key = generate_cert(local_ip)

https_port = find_available_port(8443)
http_port  = find_available_port(8080)

# Configure HTTPS Server
https_server = WEBrick::HTTPServer.new(
  Port: https_port,
  DocumentRoot: root,
  SSLEnable: true,
  SSLCertificate: cert,
  SSLPrivateKey: key,
  AccessLog: [],
  Logger: WEBrick::Log.new($stderr, WEBrick::Log::WARN)
)

# Configure HTTP Server
http_server = WEBrick::HTTPServer.new(
  Port: http_port,
  DocumentRoot: root,
  AccessLog: [],
  Logger: WEBrick::Log.new($stderr, WEBrick::Log::WARN)
)

servers = [https_server, http_server]

trap('INT')  { servers.each { |s| Thread.new { s.shutdown } } }
trap('TERM') { servers.each { |s| Thread.new { s.shutdown } } }

puts "================================================================"
puts "  ◉ LUMA GUIDE AI — Smart Dual-Protocol Server Active"
puts "================================================================"
puts ""
puts "  📱 OPEN ON YOUR SMARTPHONE (Full Camera, Mic & GPS Permissions):"
puts "     👉 https://#{local_ip}:#{https_port}"
puts "     • On first load: tap 'Advanced' -> 'Proceed to #{local_ip}'."
puts "     • Full rear camera, speech recognition & GPS are unlocked."
puts ""
puts "  💻 OPEN ON THIS MAC:"
puts "     👉 https://localhost:#{https_port}   (or http://localhost:#{http_port})"
puts ""
puts "  🌐 HTTP Fallback Available:"
puts "     👉 http://#{local_ip}:#{http_port}"
puts "================================================================"
puts "Press Ctrl+C to stop the servers."

# Run HTTP server in background thread, HTTPS on main thread
http_thread = Thread.new { http_server.start }
https_server.start
http_thread.join
