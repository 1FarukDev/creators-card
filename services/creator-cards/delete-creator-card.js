const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const CreatorCardMessages = require('@app/messages/creator-cards');
const CreatorCard = require('@app/repository/creator-card');
const serializeCreatorCard = require('./serialize-creator-card');

const spec = `root {
  creator_reference string<length:20>
}`;

const parsedSpec = validator.parse(spec);

async function deleteCreatorCard(serviceData) {
  const { slug, ...bodyData } = serviceData;
  validator.validate(bodyData, parsedSpec);

  const card = await CreatorCard.findOne({ query: { slug } });

  if (!card) {
    throwAppError(CreatorCardMessages.NOT_FOUND, 'NF01');
  }

  const deletedAt = Date.now();

  await CreatorCard.deleteOne({ query: { slug } });

  const response = serializeCreatorCard(
    { ...card, deleted: deletedAt },
    { includeAccessCode: true }
  );

  return response;
}

module.exports = deleteCreatorCard;
