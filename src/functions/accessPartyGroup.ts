import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { forbiddenReply, introspect, jsonReply } from '..';
import { AccessPolicy } from '../lib/AccessPolicy';

interface GroupBody {
  name: string;
  users: string[];
}

export async function accessPartyGroup(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) return forbiddenReply();
  const userId = introspection.user.id;

  const idParam = request.params.id;

  switch (request.method) {
    case 'GET': {
      const result = await AccessPolicy.getGroups(userId);
      if (result.isErr()) {
        context.error(result.error);
        return { status: 500 };
      }
      return jsonReply({ groups: result.value });
    }

    case 'POST': {
      const body = (await request.json()) as GroupBody;
      const result = await AccessPolicy.createGroup(userId, body.name, body.users);
      if (result.isErr()) {
        context.error(result.error);
        return { status: 500 };
      }
      return jsonReply({ group: result.value });
    }

    case 'PUT': {
      if (!idParam) return { status: 400 };
      const id = parseInt(idParam, 10);
      const body = (await request.json()) as GroupBody;
      const result = await AccessPolicy.updateGroup(userId, id, body.name, body.users);
      if (result.isErr()) {
        context.error(result.error);
        return { status: 500 };
      }
      return jsonReply({ group: result.value });
    }

    case 'DELETE': {
      if (!idParam) return { status: 400 };
      const id = parseInt(idParam, 10);
      const result = await AccessPolicy.deleteGroup(userId, id);
      if (result.isErr()) {
        context.error(result.error);
        return { status: 500 };
      }
      return { status: 204 };
    }
  }

  return { status: 405 };
}

app.http('accessPartyGroup', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  handler: accessPartyGroup,
  route: 'accessPartyGroup/{id?}',
});
