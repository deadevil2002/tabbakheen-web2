---
name: Driver delivery detail routing (mobile)
description: How the driver "delivery detail" is reached in the Tabbakheen Expo app.
---

# Driver delivery detail

`app/(driver)/my-deliveries/` now contains a real `[id].tsx` detail route. Each
delivery card in the my-deliveries tab navigates to it via
`router.push('/(driver)/my-deliveries/<id>')`. The detail screen shows order info +
`DeliveryRouteMap`; the delivery action buttons (picked up / arrived / delivered) live
on the my-deliveries tab cards (`index.tsx`), gated by `deliveryStatus`.

**How to apply:** verify the `[id].tsx` route exists before linking to it (it does as
of this writing). Available-deliveries cards have only an Accept action — no detail nav.
