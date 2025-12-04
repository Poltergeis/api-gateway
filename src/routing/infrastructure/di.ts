import { ServiceInfoRepository } from "../domain/service_info_repository.js";

import { ServiceInfoRepositoryImpl } from "./repository/service_info_repository_impl.js";

import { GetServicesUseCase } from "../application/get_services_usecase.js";

import { GetServicesController } from "./controllers/get_services_controller.js";

const services_repository: ServiceInfoRepository = new ServiceInfoRepositoryImpl();

const get_services_usecase = new GetServicesUseCase(services_repository);

export const get_services_controller = new GetServicesController(get_services_usecase);