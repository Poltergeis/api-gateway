import { ServiceInfo } from "./service.js";

export interface ServiceInfoRepository {
    get_services(): Promise<Array<ServiceInfo>>;
}