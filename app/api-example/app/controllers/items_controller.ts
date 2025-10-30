import type { HttpContext } from '@adonisjs/core/http'
import type { Item } from 'app/types/item'

let items: Item[] = [
    { id: '1', name: 'Item One', description: 'First Item' },
    { id: '2', name: 'Item Two', description: 'Second Item' },
]

export default class ItemsController {
    public async index({ response }: HttpContext) {
        response.ok({ success: true, data: items })
    }

    public async store({ request, response }: HttpContext) {
        const newItem = request.body() as Item
        items.push(newItem)
        response.created({ success: true, data: newItem })
    }

    public async update({ params, request, response }: HttpContext) {
        const id = params.id
        const updatedData = request.body() as Partial<Item>

        const index = items.findIndex((i) => i.id === id) 
            if (index === -1) {
                return response.notFound({ success: false, error: 'Item not found'})
            }
            items[index] = { ...items[index], ...updatedData }
            response.ok({ success: true, data: items[index] })
        }

        public async destroy({ params, response}: HttpContext) {
            const id = params.id
            const index = items.findIndex((i) => i.id === id)
            if (index === -1) {
                return response.notFound({ success: false, error: 'Item not found'})
            }

            items.splice(index, 1)
            response.ok({ success: true, data: null })
        }
    }