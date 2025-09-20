# Dexter MCP - NGINX Configuration(s)

This 'nginx-copy' folder contains local copies of the relevant NGINX configuration profile(s) sourced from /etc/nginx/sites-available.

Typically, subdomain rules are defined within the root domain config (e.g., dexter.cash). However, at the moment, we have an extra 'wrapper' of sorts (the mcp.dexter.cash config), so both are provided. It is up to you to understand how/if the two interact, if they should be consolidated, and sufficiency, accuracy, and maintainability.