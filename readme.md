# gapi

The "general purpose API", is the second verion of a back-end REST API I build with no clear single purpose.

It is used for [user management](https://github.com/SikoSoft/user), everything related to the [activity logger](https://github.com/SikoSoft/activity-logger) as well as the leaderboard for [ISTIT](https://github.com/SikoSoft/istit).

## Tech

First and foremost, the API is setup to run as an Azure Function App. As of writing, all of the existing functions (located within _src/functions/_) are HTTP triggers, which means they respond to REST calls through their respective endpoints.

### Prisma

In regard to communicating with the database, Prisma is used.

I am currently running a PostgreSQL server, but since this layer of direct communication with the database is abstracted away through Prisma, essentially any SQL-capable database could be used.

### tsup

The package [tsup](https://www.npmjs.com/package/tsup) is used for building the project both in local development and for production.

## Endpoints

Each endpoint contains its own entry file in the _src/functions/_ directory. The file name is usally a reflection of the path name that is used when calling the endpoint. Endpoints can be configured to be called through any number of HTTP methods.

For example, the endpoint:

`src/functions/action.ts`

... provides handling for GET, POST, PUT and DELETE methods.

## Migrations

As Prisma is the backbone in which the database layer is built upon, consult their documentation which is a lot more thorough than anything I would be able to cover here:
https://www.prisma.io/docs/orm/prisma-migrate/getting-started

### Data model changes

Every time a model (in schema.prisma) is changed, Prisma needs a new migration. Each migration should have a name. Assuming we want to call a new migration "added-user-field". we would run the following command:

```
npx prisma migration dev --name "added-user-field"
```

## Deploy
