-- The platform is now called Khmio. Replace the default name and support handle
-- written by step2_data_login, but only while they are still those defaults:
-- a value the admin already changed in Settings is left alone.
UPDATE platform_settings SET platform_name = 'Khmio'
  WHERE id = 1 AND platform_name = 'Khmer Micro-Store';

UPDATE platform_settings SET support_telegram = '@khmio_support'
  WHERE id = 1 AND support_telegram = '@kms_support';
