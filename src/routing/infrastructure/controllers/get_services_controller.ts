import { GetServicesUseCase } from "../../application/get_services_usecase.js";

export class GetServicesController {
    constructor(private readonly usecase: GetServicesUseCase) { }
    
    async run() {
        const services = await this.usecase.run();
        return services;
    }
}