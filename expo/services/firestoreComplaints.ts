import {
  createDeliveryComplaintViaWorker,
  getMyComplaintsViaWorker,
  type ComplaintRef as WorkerComplaintRef,
} from './pushApi';

export type ComplaintRef = Pick<WorkerComplaintRef, 'orderId' | 'source' | 'complaintStatus'>;

export interface CustomerComplaint {
  id: string;
  orderId: string;
  orderNumber: string;
  source: string;
  target: string;
  type: string;
  complaintStatus: string;
  note: string;
  adminNote: string;
  createdAt: number | null;
  updatedAt: number | null;
}

const toMillis = (value: string): number | null => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const toCustomerComplaint = (item: WorkerComplaintRef): CustomerComplaint => ({
  ...item,
  createdAt: toMillis(item.createdAt),
  updatedAt: toMillis(item.updatedAt),
});

/**
 * Compatibility subscription facade backed only by the authenticated Worker.
 * No complaint participant UID is queried from Firestore on the device.
 */
export function fsSubscribeComplaintsByCreator(
  role: 'customer' | 'provider' | 'driver',
  _uid: string,
  cb: (complaints: CustomerComplaint[]) => void,
): () => void {
  let active = true;
  const refresh = async () => {
    try {
      const complaints = await getMyComplaintsViaWorker();
      if (active) cb(complaints.filter((item) => item.source === role).map(toCustomerComplaint));
    } catch {
      if (active) cb([]);
    }
  };
  void refresh();
  const poll = setInterval(() => { void refresh(); }, 30_000);
  return () => {
    active = false;
    clearInterval(poll);
  };
}

export function fsSubscribeCustomerComplaints(
  customerUid: string,
  cb: (complaints: CustomerComplaint[]) => void,
): () => void {
  return fsSubscribeComplaintsByCreator('customer', customerUid, cb);
}

export function fsSubscribeMyComplaints(
  _field: 'customerUid' | 'providerUid' | 'driverUid',
  _value: string,
  cb: (complaints: ComplaintRef[]) => void,
): () => void {
  let active = true;
  const refresh = async () => {
    try {
      const complaints = await getMyComplaintsViaWorker();
      if (active) cb(complaints.map(({ orderId, source, complaintStatus }) => ({ orderId, source, complaintStatus })));
    } catch {
      if (active) cb([]);
    }
  };
  void refresh();
  const poll = setInterval(() => { void refresh(); }, 30_000);
  return () => {
    active = false;
    clearInterval(poll);
  };
}

export interface ComplaintInput {
  orderId: string;
  orderNumber: string;
  orderRef: string;
  customerUid: string;
  providerUid: string;
  driverUid: string;
  status: string;
  deliveryStatus: string;
  type: string;
  note: string;
  source: string;
  target?: string;
}

export async function fsCreateComplaint(input: ComplaintInput): Promise<string> {
  const type = input.type === 'customer_rejected_receipt'
    ? 'customer_rejected_receipt'
    : input.type === 'delivery_not_confirmed'
      ? 'delivery_not_confirmed'
      : input.type === 'customer_complaint'
        ? 'customer_complaint'
        : input.type === 'provider_complaint'
          ? 'provider_complaint'
          : null;
  if (!type) throw new Error('Unsupported complaint type');
  const target = input.target === 'customer' || input.target === 'provider' || input.target === 'driver'
    ? input.target
    : undefined;
  const complaint = await createDeliveryComplaintViaWorker(input.orderId, type, input.note, target);
  return complaint.id;
}