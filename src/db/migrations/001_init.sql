CREATE TABLE invitations (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  token_hash    CHAR(64) NOT NULL UNIQUE,
  category      VARCHAR(20) NOT NULL,
  status        ENUM('ativo','usado','expirado') NOT NULL DEFAULT 'ativo',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retain_until  DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE guest_invites (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  token_hash     CHAR(64) NOT NULL UNIQUE,
  invitation_id  BIGINT NOT NULL,
  total_uses     INT NOT NULL,
  used_uses      INT NOT NULL DEFAULT 0,
  CHECK (used_uses <= total_uses),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id)
) ENGINE=InnoDB;

CREATE TABLE registrations (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  invitation_id  BIGINT NOT NULL UNIQUE,
  payload_json   JSON NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id)
) ENGINE=InnoDB;

CREATE TABLE photos (
  id             CHAR(36) PRIMARY KEY,
  repository     CHAR(64) NOT NULL,
  invite_hash    CHAR(64) NOT NULL,
  file_path      VARCHAR(255) NOT NULL,
  mime           VARCHAR(40) NOT NULL,
  bytes          INT NOT NULL,
  used_by        BIGINT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY (used_by, created_at),
  FOREIGN KEY (used_by) REFERENCES registrations(id)
) ENGINE=InnoDB;

CREATE TABLE guests (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  invitation_id  BIGINT NOT NULL,
  source         ENUM('manual','autocadastro') NOT NULL,
  name           VARCHAR(80) NOT NULL,
  last_name      VARCHAR(80) NOT NULL,
  email          VARCHAR(160) NOT NULL,
  phone          VARCHAR(40) NOT NULL,
  document_hash  CHAR(64) NULL,
  document_enc   VARBINARY(255) NULL,
  birth_date     DATE NULL,
  is_minor       BOOLEAN NOT NULL DEFAULT FALSE,
  photo_id       CHAR(36) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retain_until   DATETIME NULL,
  UNIQUE KEY uq_doc (invitation_id, document_hash),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id),
  FOREIGN KEY (photo_id) REFERENCES photos(id)
) ENGINE=InnoDB;

CREATE TABLE legal_documents (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  type         ENUM('privacy','terms') NOT NULL,
  version      VARCHAR(20) NOT NULL,
  effective_at DATETIME NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY (type, version)
) ENGINE=InnoDB;

CREATE TABLE legal_acceptances (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  document_id    INT NOT NULL,
  invitation_id  BIGINT NOT NULL,
  guest_id       BIGINT NULL,
  declaration    ENUM('titular','responsavel_terceiro','responsavel_legal') NOT NULL,
  accepted_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address     VARCHAR(45) NOT NULL,
  user_agent     VARCHAR(255) NULL,
  context        ENUM('autocadastro','convidado') NOT NULL,
  FOREIGN KEY (document_id) REFERENCES legal_documents(id),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id),
  FOREIGN KEY (guest_id) REFERENCES guests(id)
) ENGINE=InnoDB;

INSERT INTO legal_documents (type, version, effective_at, active) VALUES
  ('privacy', '1.0', NOW(), TRUE),
  ('terms',   '1.0', NOW(), TRUE);
