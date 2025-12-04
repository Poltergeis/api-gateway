import { ServiceInfo } from "../domain/service.js";
import { ServiceInfoRepository } from "../domain/service_info_repository.js";

export class GetServicesUseCase {
    constructor(private readonly repository: ServiceInfoRepository) { }
    
    async run() {
        const services = await this.repository.get_services();
        return services;
    }
}