-- convite principal de uso contínuo: várias pessoas se cadastram pelo mesmo token, então o dono dos convidados, dos
-- links de autocadastro e das fotos passa a ser o cadastro (registrations), não o convite

-- fotos: used_by passa a apontar para registrations (as de teste ficam sem dono)
UPDATE photos SET used_by = NULL;
ALTER TABLE photos DROP FOREIGN KEY fk_photos_used_by;
ALTER TABLE photos
  ADD CONSTRAINT fk_photos_used_by FOREIGN KEY (used_by) REFERENCES registrations(id);

-- vários cadastros por convite; a categoria é de cada cadastro, não do convite
ALTER TABLE registrations
  ADD COLUMN category VARCHAR(20) NULL AFTER invitation_id,
  ADD KEY idx_registrations_invitation (invitation_id),
  DROP INDEX invitation_id;

-- convidados: documento repetido é checado dentro do cadastro do responsável
ALTER TABLE guests
  ADD COLUMN registration_id BIGINT NULL AFTER invitation_id,
  ADD KEY idx_guests_invitation (invitation_id),
  DROP INDEX uq_doc,
  ADD UNIQUE KEY uq_guest_doc (registration_id, document_hash),
  ADD CONSTRAINT fk_guests_registration FOREIGN KEY (registration_id) REFERENCES registrations(id);

-- link de autocadastro: pertence ao cadastro do responsável
ALTER TABLE guest_invites
  ADD COLUMN registration_id BIGINT NULL AFTER invitation_id,
  ADD CONSTRAINT fk_guest_invites_registration FOREIGN KEY (registration_id) REFERENCES registrations(id);
