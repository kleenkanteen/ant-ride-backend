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
const ParticipantsController = () => import('#controllers/participants_controller')

router.post('event', [EventsController, 'create'])
router.put('event', [EventsController, 'edit'])

router.post('participant', [ParticipantsController, 'create'])
router.put('participant', [ParticipantsController, 'edit'])
