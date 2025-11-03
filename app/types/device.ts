import { Question } from "./question";

export interface Device {
  id: number;
  nplan: number;
  code: string | null;
  area: Area;
  control_point: ControlPoint;
  floorplan: Floorplan;
  questions: Question[];
}

interface Area {
  id: number;
  name: string;
}

interface ControlPoint {
  id: string;
  name: string;
  code: string;
}

interface Floorplan {
  id: number;
  name: string;
  service_name: string;
}
