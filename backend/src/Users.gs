/**
 * Users.gs
 * Kelola akun (Owner/Admin/Kasir/Capster) -- permission 'kelolaUser' (Owner saja).
 * PasswordHash/PasswordSalt TIDAK PERNAH dikembalikan ke klien.
 */

function stripSecrets_(user) {
  var clean = Object.assign({}, user);
  delete clean.PasswordHash;
  delete clean.PasswordSalt;
  return clean;
}

function usersList_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'kelolaUser');
  var data = getSheetData_(SHEETS.KASIR);
  return { users: data.rows.map(stripSecrets_) };
}

function usersSave_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'kelolaUser');
  requireFields_(payload, ['nama', 'username', 'role']);

  if (Object.keys(ROLES).map(function (k) { return ROLES[k]; }).indexOf(payload.role) === -1) {
    throw new AppError_('VALIDATION_ERROR', 'Role tidak valid.');
  }

  var username = sanitizeString_(payload.username).toLowerCase();
  var data = getSheetData_(SHEETS.KASIR);
  var usernameTaken = data.rows.some(function (r) {
    return String(r.Username).toLowerCase() === username && r.ID !== payload.id;
  });
  if (usernameTaken) throw new AppError_('VALIDATION_ERROR', 'Username sudah dipakai akun lain.');

  if (payload.id) {
    var existing = findRowById_(SHEETS.KASIR, payload.id);
    if (!existing) throw new AppError_('NOT_FOUND', 'Akun tidak ditemukan.');

    existing.Nama = sanitizeString_(payload.nama);
    existing.Username = username;
    existing.Role = payload.role;
    existing.CapsterID = payload.capsterId || '';
    existing.Status = payload.status ? sanitizeString_(payload.status) : existing.Status;
    existing.UpdatedAt = new Date();

    if (payload.password) {
      if (String(payload.password).length < 6) throw new AppError_('VALIDATION_ERROR', 'Password minimal 6 karakter.');
      var salt = generateSalt_();
      existing.PasswordSalt = salt;
      existing.PasswordHash = hashPassword_(payload.password, salt);
    }

    updateRowObject_(SHEETS.KASIR, existing._rowIndex, existing);
    writeAuditLog_(session, 'UPDATE_USER', SHEETS.KASIR, '', stripSecrets_(existing));
    return { user: stripSecrets_(existing) };
  }

  requireFields_(payload, ['password']);
  if (String(payload.password).length < 6) throw new AppError_('VALIDATION_ERROR', 'Password minimal 6 karakter.');

  var newSalt = generateSalt_();
  var record = {
    ID: generateId_('USR'),
    Nama: sanitizeString_(payload.nama),
    Username: username,
    PasswordHash: hashPassword_(payload.password, newSalt),
    PasswordSalt: newSalt,
    Role: payload.role,
    CapsterID: payload.capsterId || '',
    Status: 'Aktif',
    CreatedAt: new Date(),
    UpdatedAt: new Date()
  };
  appendRowObject_(SHEETS.KASIR, record);
  writeAuditLog_(session, 'CREATE_USER', SHEETS.KASIR, '', stripSecrets_(record));
  return { user: stripSecrets_(record) };
}
