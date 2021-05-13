import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from 'next-auth/client'
import { fauna } from "../../services/fauna";
import {stripe} from '../../services/stripe'
import { query as q } from 'faunadb'

type User = {
  ref: {
    id: string
  }
  data: {
    stripe_customer_id: string
  }
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if(req.method === 'POST') {

    const session = await getSession({req})
    console.log(session.user.email)

    
      const user = await fauna.query<User> (
        q.Get(
          q.Match(
            q.Index('user_by_email'),
            session.user.email
          )
        )
      )
    
    let customerId = user.data.stripe_customer_id
    
    if(!customerId){
      console.log('entrouooooooo')
      const stripeCustomer = await stripe.customers.create({
        email: session.user.email
      })
    

      await fauna.query(
        q.Update(
          q.Ref(q.Collection('users'), user.ref.id),
          {
            data: {
              stripe_customer_id: stripeCustomer.id
            }
          }
        )
      )
      customerId = stripeCustomer.id
    }


    const stripeCheckoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      line_items: [
        {price: 'price_1ImNNaBkeDgSbV1ITYCS7oLw', quantity: 1}
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      success_url: 'http://localhost:3000/posts',
      cancel_url: 'http://localhost:3000/'
    })

    return res.status(200).json({sessionId: stripeCheckoutSession.id})
  } else {
    res.setHeader('Allow', 'POST')
    res.status(405).end('Method not allowed')
  }
} 