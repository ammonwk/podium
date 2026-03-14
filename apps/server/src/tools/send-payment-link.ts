import Stripe from 'stripe';
import type { SendPaymentLinkInput, SendPaymentLinkResult } from '@apm/shared';
import { BookingModel, PropertyModel } from '../shared/db.js';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key);
}

export async function executeSendPaymentLink(
  input: SendPaymentLinkInput,
): Promise<SendPaymentLinkResult> {
  const { booking_id } = input;

  // Look up the booking
  const booking = await BookingModel.findOne({ id: booking_id }).lean();
  if (!booking) {
    throw new Error(`Booking not found: ${booking_id}`);
  }

  // Look up the property for pricing
  const property = await PropertyModel.findOne({ id: booking.property_id }).lean();
  if (!property) {
    throw new Error(`Property not found: ${booking.property_id}`);
  }

  // Calculate total
  const checkInDate = new Date(booking.check_in);
  const checkOutDate = new Date(booking.check_out);
  const nights = Math.round(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const totalCents = nights * property.current_price * 100;

  // Check if a payment link was already created for this booking
  if (booking.payment_link && booking.payment_status === 'pending') {
    return {
      booking_id,
      payment_url: booking.payment_link,
      amount_cents: totalCents,
      total_display: `$${(totalCents / 100).toFixed(2)}`,
      status: 'already_created',
    };
  }

  // Create a Stripe Checkout Session
  const checkInFormatted = checkInDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const checkOutFormatted = checkOutDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const session = await getStripe().checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${property.name} — ${nights} night${nights > 1 ? 's' : ''}`,
            description: `${checkInFormatted} to ${checkOutFormatted} | Booking ${booking_id}`,
          },
          unit_amount: totalCents,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.APP_URL || 'https://hackathon.plaibook.tech'}/booking/${booking_id}/confirmed`,
    cancel_url: `${process.env.APP_URL || 'https://hackathon.plaibook.tech'}/booking/${booking_id}/cancelled`,
    metadata: {
      booking_id,
      property_id: booking.property_id,
      guest_phone: booking.guest_phone,
    },
  });

  // Save the payment link to the booking
  await BookingModel.updateOne(
    { id: booking_id },
    { payment_status: 'pending', payment_link: session.url },
  );

  return {
    booking_id,
    payment_url: session.url!,
    amount_cents: totalCents,
    total_display: `$${(totalCents / 100).toFixed(2)}`,
    status: 'link_created',
  };
}
