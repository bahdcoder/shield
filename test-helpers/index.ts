/*
* @adonisjs/shield
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { Socket } from 'net'
import { join } from 'path'
import { Edge } from 'edge.js'
import { Ioc } from '@adonisjs/fold'
import { CsrfMiddleware } from '../src/csrf'
import { Filesystem } from '@poppinss/dev-utils'
import { CsrfOptions } from '@ioc:Adonis/Addons/Shield'
import { IncomingMessage, IncomingHttpHeaders } from 'http'
import { FakeLogger } from '@adonisjs/logger/build/standalone'
import { Profiler } from '@adonisjs/profiler/build/standalone'
import { SessionConfigContract } from '@ioc:Adonis/Addons/Session'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { HttpContext } from '@adonisjs/http-server/build/standalone'
import { SessionManager } from '@adonisjs/session/build/src/SessionManager'

export const Fs = new Filesystem(join(__dirname, 'views'))

const logger = new FakeLogger({ level: 'trace', enabled: false, name: 'adonisjs' })
const profiler = new Profiler(__dirname, logger, {})
const sessionConfig: SessionConfigContract = {
  driver: 'cookie',
  cookieName: 'adonis-session',
  clearWithBrowser: false,
  age: '2h',
  cookie: {
    path: '/',
  },
}

export function getCtx () {
  return HttpContext.create('/', {}, logger, profiler.create(''), {} as any) as HttpContextContract
}

export async function getCtxWithSession (routePath: string = '/', routeParams = {}, request?: IncomingMessage) {
  HttpContext.getter('session', function session () {
    const sessionManager = new SessionManager(new Ioc(), sessionConfig)

    return sessionManager.create(this)
  }, true)

  HttpContext.getter('view', function view () {
    const edge = new Edge()

    edge.mount(Fs.basePath)
    return edge.share({ request: this.request, route: this.route })
  }, true)

  const httpContext = HttpContext.create(
    routePath,
    routeParams,
    logger,
    profiler.create(''),
    {} as any,
    request
  ) as HttpContextContract

  await httpContext.session.initiate(false)

  return httpContext
}

export function getCtxFromIncomingMessage (headers: IncomingHttpHeaders = {}, routePath = '/', routeParams = {}) {
  const request = new IncomingMessage(new Socket())
  request.headers = headers

  return getCtxWithSession(routePath, routeParams, request)
}

export async function getCsrfMiddlewareInstance (options: CsrfOptions, applicationKey: string) {
  return new CsrfMiddleware((await getCtxWithSession()).session, options, applicationKey)
}
