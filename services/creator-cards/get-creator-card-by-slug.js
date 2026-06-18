const { throwAppError } = require('@app-core/errors');
const CreatorCardMessages = require('@app/messages/creator-cards');
const CreatorCard = require('@app/repository/creator-card');
const serializeCreatorCard = require('./serialize-creator-card');

async function getCreatorCardBySlug(serviceData) {
  const { slug, access_code: accessCode } = serviceData;

  const card = await CreatorCard.findOne({ query: { slug } });

  if (!card) {
    throwAppError(CreatorCardMessages.NOT_FOUND, 'NF01');
  }

  if (card.status === 'draft') {
    throwAppError(CreatorCardMessages.DRAFT_NOT_FOUND, 'NF02');
  }

  if (card.access_type === 'private' && !accessCode) {
    throwAppError(CreatorCardMessages.PRIVATE_ACCESS_REQUIRED, 'AC03');
  }

  if (card.access_type === 'private' && accessCode !== card.access_code) {
    throwAppError(CreatorCardMessages.INVALID_ACCESS_CODE, 'AC04');
  }

  const response = serializeCreatorCard(card);

  return response;
}

module.exports = getCreatorCardBySlug;
