-- Update NIC International College (ID 4) with branding
UPDATE institutions SET
  subdomain = 'nic',
  primary_color = '#110b65',
  secondary_color = '#ffffff',
  logo_url = '/logos/nic-logo.png',
  favicon_url = '/favicon.ico',
  welcome_text = 'Welcome to the NIC Student Portal'
WHERE id = 4;

-- Verify the update
SELECT id, name, subdomain, primary_color, secondary_color, logo_url, welcome_text 
FROM institutions 
WHERE id = 4;
