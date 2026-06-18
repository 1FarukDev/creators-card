function serializeCreatorCard(doc, options = {}) {
  const { includeAccessCode = false } = options;
  const { _id, deleted, access_code: accessCode, __v, ...rest } = doc;

  const serialized = {
    id: _id,
    ...rest,
    access_type: rest.access_type || 'public',
    deleted: deleted === 0 || deleted == null ? null : deleted,
  };

  if (includeAccessCode) {
    serialized.access_code = accessCode || null;
  }

  return serialized;
}

module.exports = serializeCreatorCard;
