const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { randomNumbers } = require('@app-core/randomness');
const CreatorCardMessages = require('@app/messages/creator-cards');
const CreatorCard = require('@app/repository/creator-card');
const serializeCreatorCard = require('./serialize-creator-card');

const spec = `root {
  title string<trim|minLength:3|maxLength:100>
  description? string<trim|maxLength:500>
  slug? string<trim|minLength:5|maxLength:50>
  creator_reference string<length:20>
  links[]? {
    title string<trim|minLength:1|maxLength:100>
    url string<trim|maxLength:200>
  }
  service_rates? {
    currency string(NGN|USD|GBP|GHS)
    rates[] {
      name string<trim|minLength:3|maxLength:100>
      description string<trim|maxLength:250>
      amount number<min:1>
    }
  }
  status string(draft|published)
  access_type? string(public|private)
  access_code? string<length:6>
}`;

const parsedSpec = validator.parse(spec);

const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';

function isSlugCharacter(char) {
  const code = char.charCodeAt(0);
  return (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || char === '-' || char === '_';
}

function isAlphanumeric(value) {
  for (let i = 0; i < value.length; i += 1) {
    if (!ALPHANUMERIC.includes(value[i].toLowerCase())) {
      return false;
    }
  }
  return true;
}

function randomAlphanumeric(length) {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += ALPHANUMERIC[randomNumbers(0, ALPHANUMERIC.length - 1)];
  }
  return result;
}

function validateSlugFormat(slug) {
  for (let i = 0; i < slug.length; i += 1) {
    if (!isSlugCharacter(slug[i])) {
      throwAppError('slug contains invalid characters', 'VALIDATIONERR');
    }
  }
}

function generateSlugFromTitle(title) {
  const slug = title.toLowerCase().trim();
  let normalized = '';

  for (let i = 0; i < slug.length; i += 1) {
    const char = slug[i];
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      normalized += '-';
    } else {
      normalized += char;
    }
  }

  let result = '';
  for (let i = 0; i < normalized.length; i += 1) {
    if (isSlugCharacter(normalized[i])) {
      result += normalized[i];
    }
  }

  return result;
}

async function slugExists(slug) {
  const existing = await CreatorCard.findOne({ query: { slug } });
  return !!existing;
}

async function ensureUniqueSlug(candidateSlug, title) {
  if (!(await slugExists(candidateSlug))) {
    return candidateSlug;
  }
  const nextSlug = `${generateSlugFromTitle(title)}-${randomAlphanumeric(6)}`;
  return ensureUniqueSlug(nextSlug, title);
}

async function resolveSlug(data) {
  const clientProvidedSlug = typeof data.slug === 'string' && data.slug.length > 0;

  if (clientProvidedSlug) {
    validateSlugFormat(data.slug);
    if (await slugExists(data.slug)) {
      throwAppError(CreatorCardMessages.SLUG_TAKEN, 'SL02');
    }
    return data.slug;
  }

  let slug = generateSlugFromTitle(data.title);

  if (slug.length < 5 || (await slugExists(slug))) {
    slug = `${slug}-${randomAlphanumeric(6)}`;
  }

  return ensureUniqueSlug(slug, data.title);
}

function validateLinks(links) {
  if (!links) return;

  links.forEach((link) => {
    if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
      throwAppError('url must start with http:// or https://', 'VALIDATIONERR');
    }
  });
}

function validateServiceRates(serviceRates) {
  if (!serviceRates) return;

  if (!serviceRates.rates || serviceRates.rates.length === 0) {
    throwAppError('service_rates.rates must not be empty', 'VALIDATIONERR');
  }
}

function validateAccessRules(data, accessType) {
  if (accessType === 'private') {
    if (!data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_REQUIRED, 'AC01');
    }
    if (!isAlphanumeric(data.access_code)) {
      throwAppError('access_code must be alphanumeric', 'VALIDATIONERR');
    }
    return;
  }

  if (data.access_code) {
    throwAppError(CreatorCardMessages.ACCESS_CODE_NOT_ALLOWED, 'AC05');
  }
}

async function createCreatorCard(serviceData) {
  const data = validator.validate(serviceData, parsedSpec);
  const accessType = data.access_type || 'public';

  validateAccessRules(data, accessType);
  validateLinks(data.links);
  validateServiceRates(data.service_rates);

  const slug = await resolveSlug(data);

  const card = await CreatorCard.create({
    title: data.title,
    description: data.description,
    slug,
    creator_reference: data.creator_reference,
    links: data.links,
    service_rates: data.service_rates,
    status: data.status,
    access_type: accessType,
    access_code: accessType === 'private' ? data.access_code : null,
  });

  const response = serializeCreatorCard(card, { includeAccessCode: true });

  return response;
}

module.exports = createCreatorCard;
