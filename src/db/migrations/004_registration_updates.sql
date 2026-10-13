-- novo envio com o mesmo documento atualiza o cadastro existente: registra qual convite fez a última atualização
ALTER TABLE registrations
  ADD COLUMN last_invitation_id BIGINT NULL,
  ADD COLUMN updated_at DATETIME NULL,
  ADD KEY idx_registrations_document (document_hash),
  ADD CONSTRAINT fk_registrations_last_invitation FOREIGN KEY (last_invitation_id) REFERENCES invitations(id);
