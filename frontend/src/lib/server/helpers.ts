import { error as kitError } from '@sveltejs/kit';

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function error(status: number, detail: string): never {
  throw kitError(status, { message: detail });
}

export async function parseBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    error(422, 'invalid JSON body');
  }
}

export function getProjectHeaders(request: Request): {
  projectId: string | null;
  projectSlug: string | null;
} {
  return {
    projectId: request.headers.get('X-Project-Id'),
    projectSlug: request.headers.get('X-Project-Slug')
  };
}
