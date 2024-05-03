/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

const EventsController = () => import('#controllers/events_controller')

router.post('event', [EventsController, 'create'])
