#!/usr/bin/env ruby
# LUMA Guide AI — Local HTTP & HTTPS Mobile Server
# Zero external dependencies. Uses Ruby standard library (WEBrick).

require 'webrick'
require 'socket'

# Determine local IP address
local_ip = Socket.ip_address_list.find do |addr|
  addr.ipv4? && !addr.ipv4_loopback? && !addr.ip_address.start_with?('169.254')
end&.ip_address || '127.0.0.1'

root = File.expand_path(__dir__)
use_ssl = ARGV.include?('--ssl') || ARGV.include?('-s')
port = (ARGV.find { |a| a =~ /^\d+$/ } || (use_ssl ? 8443 : 8080)).to_i

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

port = find_available_port(port)

server_config = {
  Port: port,
  DocumentRoot: root,
  AccessLog: [],
  Logger: WEBrick::Log.new($stderr, WEBrick::Log::WARN)
}

if use_ssl
  require 'webrick/https'
  server_config[:SSLEnable] = true
  server_config[:SSLCertName] = [['CN', local_ip]]
end

protocol = use_ssl ? 'https' : 'http'
server = WEBrick::HTTPServer.new(server_config)

trap('INT')  { server.shutdown }
trap('TERM') { server.shutdown }

puts "================================================================"
puts "  ◉ LUMA GUIDE AI — Mobile Server Active (#{protocol.upcase})"
puts "================================================================"
puts ""
puts "  📱 OPEN ON YOUR MOBILE PHONE (Same Wi-Fi):"
puts "     #{protocol}://#{local_ip}:#{port}"
puts ""
puts "  💻 OPEN ON THIS MAC:"
puts "     #{protocol}://localhost:#{port}"
puts ""
if use_ssl
  puts "  🔒 SSL / HTTPS Mode is ACTIVE:"
  puts "     • Full Rear Camera & Microphone permissions are enabled."
  puts "     • On first load, tap 'Advanced' -> 'Proceed to #{local_ip}'."
else
  puts "  💡 CAMERA PERMISSION TIP FOR SMARTPHONES:"
  puts "     • For instant testing: Use LUMA's built-in 'Simulation Demo'."
  puts "     • For REAL smartphone camera access, restart with HTTPS:"
  puts "       ruby server.rb --ssl"
end
puts "================================================================"
puts "Press Ctrl+C to stop the server."

server.start
