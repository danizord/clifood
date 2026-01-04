export type Restaurant = {
  id?: string;
  slug?: string;
  name: string;
  url: string;
  info?: string;
};

export type MenuItem = {
  id?: string;
  name: string;
  price?: number;
  priceText?: string;
  description?: string;
  section?: string;
};
