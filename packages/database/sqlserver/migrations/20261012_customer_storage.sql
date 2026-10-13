-- Additive migration. Existing rows remain LEGACY until their physical owner is audited.
IF COL_LENGTH('dbo.videos', 'storage_owner') IS NULL
  ALTER TABLE dbo.videos ADD storage_owner VARCHAR(20) NOT NULL CONSTRAINT DF_videos_storage_owner DEFAULT 'LEGACY';
GO
IF COL_LENGTH('dbo.videos', 'drive_file_id') IS NULL
  ALTER TABLE dbo.videos ADD drive_file_id VARCHAR(200) NULL;
GO
