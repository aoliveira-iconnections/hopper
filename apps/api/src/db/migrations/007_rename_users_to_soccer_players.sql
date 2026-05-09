-- Rename the existing demo users from anonymized placeholders to Brazilian
-- football legends. Idempotent via WHERE-by-old-email; on a fresh DB where
-- migration 003 already inserted these rows, the UPDATE simply renames them.
UPDATE users SET email = 'marta@iconnections.io',      name = 'Marta Vieira'         WHERE email = 'maya@iconnections.io';
UPDATE users SET email = 'ronaldinho@iconnections.io', name = 'Ronaldinho Gaúcho'    WHERE email = 'sam@iconnections.io';
UPDATE users SET email = 'pele@iconnections.io',       name = 'Pelé Nascimento'      WHERE email = 'jules@iconnections.io';
UPDATE users SET email = 'kaka@iconnections.io',       name = 'Kaká Leite'           WHERE email = 'priya@iconnections.io';
UPDATE users SET email = 'neymar@iconnections.io',     name = 'Neymar Júnior'        WHERE email = 'devon@iconnections.io';
UPDATE users SET email = 'ronaldo@iconnections.io',    name = 'Ronaldo Nazário'      WHERE email = 'ana@iconnections.io';
