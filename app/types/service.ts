import { Product } from "./product";
import { Pest } from "./pest";
import { ApplicationMethod } from "./application-method";
import { Device } from "./device";

export interface Service {
  id: number;
  prefix: number;
  name: string;
  description?: string;
  pests: Pest[];
  products: Product[];
  application_methods: ApplicationMethod[];
  devices: Device[];
  quantity?: number;
  frequency?: string;
}
