import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createUserDocument, updateUserDocument, deleteUserDocument } from '@/lib/firebase-admin'

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || '')

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400,
    })
  }

  // Handle the webhook
  const { id } = evt.data
  const eventType = evt.type

  console.log(`Webhook with ID ${id} and type ${eventType}`)
  console.log('Webhook body:', body)

  // Handle user created event
  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name, username } = evt.data

    try {
      await createUserDocument({
        uid: id,
        email: email_addresses[0].email_address,
        username: username || undefined,
        firstName: first_name || undefined,
        lastName: last_name || undefined,
      })
      console.log(`User ${id} created in Firestore`)
    } catch (error) {
      console.error('Error creating user in Firestore:', error)
      return new Response('Error creating user', { status: 500 })
    }
  }

  // Handle user updated event
  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, username } = evt.data

    try {
      const updates: any = {}
      
      if (email_addresses && email_addresses.length > 0) {
        updates.email = email_addresses[0].email_address
      }
      
      if (username) {
        updates.username = username
      }
      
      if (first_name || last_name) {
        updates['profile.name'] = `${first_name || ''} ${last_name || ''}`.trim()
      }

      await updateUserDocument(id, updates)
      console.log(`User ${id} updated in Firestore`)
    } catch (error) {
      console.error('Error updating user in Firestore:', error)
      return new Response('Error updating user', { status: 500 })
    }
  }

  // Handle user deleted event
  if (eventType === 'user.deleted') {
    try {
      await deleteUserDocument(id!)
      console.log(`User ${id} marked as deleted in Firestore`)
    } catch (error) {
      console.error('Error deleting user in Firestore:', error)
      return new Response('Error deleting user', { status: 500 })
    }
  }

  return new Response('', { status: 200 })
}