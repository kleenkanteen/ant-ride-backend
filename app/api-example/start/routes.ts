/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

router.get('/api/items', async () => {
  'ItemsController.index'
})
router.post('/api/items', async () => {
  'ItemsController.store'
})
router.put('/api/items:id', async () => {
  'ItemsController.update'
})
router.delete('/api/items:id', async () => {
  'ItemsController.destroy'
}).prefix('/api')