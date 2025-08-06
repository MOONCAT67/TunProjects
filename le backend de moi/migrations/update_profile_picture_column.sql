-- Change profile_picture column type from VARCHAR to MEDIUMTEXT (supports up to 16MB)
ALTER TABLE users MODIFY COLUMN profile_picture MEDIUMTEXT; 