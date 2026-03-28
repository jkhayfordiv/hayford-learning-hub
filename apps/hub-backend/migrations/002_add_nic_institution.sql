-- ============================================================================
-- ADD NIC COLLEGE INSTITUTION
-- ============================================================================
-- This migration creates the NIC College institution with proper branding
-- ============================================================================

-- Create NIC College institution if it doesn't exist
INSERT INTO institutions (name, subdomain, timezone, has_grammar_world, has_ielts_speaking, primary_color, secondary_color, logo_url, favicon_url, welcome_text)
VALUES (
  'NIC College',
  'nic',
  'Asia/Tokyo',
  true,
  true,
  '#110b65',
  '#ffffff',
  '/logos/nic-logo.png',
  '/favicon.ico',
  'Welcome to the NIC Student Portal'
)
ON CONFLICT (name) DO UPDATE SET
  subdomain = EXCLUDED.subdomain,
  timezone = EXCLUDED.timezone,
  has_grammar_world = EXCLUDED.has_grammar_world,
  has_ielts_speaking = EXCLUDED.has_ielts_speaking,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  logo_url = EXCLUDED.logo_url,
  favicon_url = EXCLUDED.favicon_url,
  welcome_text = EXCLUDED.welcome_text;

-- Verify the institution was created
SELECT id, name, subdomain, primary_color FROM institutions WHERE subdomain = 'nic';
