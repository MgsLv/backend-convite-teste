-- fotos usadas passam a apontar para o convite do responsável (vale para autocadastro e convidado)
ALTER TABLE photos DROP FOREIGN KEY photos_ibfk_1;
ALTER TABLE photos
  ADD CONSTRAINT fk_photos_used_by FOREIGN KEY (used_by) REFERENCES invitations(id);

-- hash do documento do responsável, para a checagem de duplicidade
ALTER TABLE registrations
  ADD COLUMN document_hash CHAR(64) NULL AFTER invitation_id;
