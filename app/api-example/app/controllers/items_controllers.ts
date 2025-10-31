import type { HttpContext } from '@adonisjs/core/http'

export default class ItemsController {
    public async index({ response }: HttpContext) {
        response.send('List of items')
    }

    public async store({ request, response }: HttpContext) {
        const newItem = request.only(['name'])
        response.send(`Item added: ${newItem.name}`)
    }

    public async update({ params, response }: HttpContext) {
        const itemId = params.id
       response.send(`Item with ID ${itemId} updated`)
    }

    public async destroy({ params, response}: HttpContext) {
        const itemId = params.id
        response.send(`Item with ID ${itemId} deleted`)
    }
}