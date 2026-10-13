-- o convite nasce sem categoria; ela é definida no autocadastro
ALTER TABLE invitations MODIFY category VARCHAR(20) NULL;
