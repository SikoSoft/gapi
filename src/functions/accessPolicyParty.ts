import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { forbiddenReply, introspect, jsonReply } from '..';
import { AccessPolicy } from '../lib/AccessPolicy';

export async function accessPolicyParty(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) return forbiddenReply();
  const userId = introspection.user.id;

  const query = request.params.query;
  const result = await AccessPolicy.getParties(userId, query);

  if (result.isErr()) {
    context.error(result.error);
    return { status: 500 };
  }

  return jsonReply({ parties: result.value });
}

app.http('accessPolicyParty', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: accessPolicyParty,
  route: 'accessPolicyParty/{query?}',
});
