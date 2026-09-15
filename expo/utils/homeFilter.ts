import { Offer, OfferCategory } from '../types';

export type CategoryFilter = 'all' | OfferCategory;
export type OrderTypeFilter = 'all' | 'immediate' | 'preorder';

export interface HomeFilterState {
  category: CategoryFilter;
  orderType: OrderTypeFilter;
  search: string;
}

export function updateCategory(state: HomeFilterState, category: CategoryFilter): HomeFilterState {
  return { ...state, category };
}

export function updateOrderType(state: HomeFilterState, orderType: OrderTypeFilter): HomeFilterState {
  return { ...state, orderType };
}

export function filterOffers(
  offers: Offer[],
  state: HomeFilterState
): Offer[] {
  let result = offers;

  if (state.orderType !== 'all') {
    result = result.filter((o) => {
      const type = o.availabilityType === 'preorder' ? 'preorder' : 'immediate';
      return type === state.orderType;
    });
  }

  if (state.category !== 'all') {
    result = result.filter((o) => {
      const cat = o.category || 'other';
      return cat === state.category;
    });
  }

  if (state.search.trim()) {
    const q = state.search.toLowerCase();
    result = result.filter(
      (o) => o.title.toLowerCase().includes(q) || o.description.toLowerCase().includes(q),
    );
  }

  return result;
}
