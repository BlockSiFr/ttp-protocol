import { Decision } from './models.js';

/** @param {import('./models.js').AuthorizeRequest} request */
export async function authorize(request) {
  const { baseUrl, ...body } = request;
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/re/authorize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`authorize failed: ${response.status}`);
  }

  const json = await response.json();
  return json;
}

export { Decision };
