import { ServiceInfo } from "../../domain/service.js";
import { ServiceInfoRepository } from "../../domain/service_info_repository.js";
import { services_path } from "../../../local_paths.js";
import fs from "fs";

export class ServiceInfoRepositoryImpl implements ServiceInfoRepository {
    async get_services(): Promise<Array<ServiceInfo>> {
        return new Promise((resolve, reject) => {
            const services_buffer = fs.readFileSync(services_path, {
                encoding: "utf-8"
            });
            const services_json = JSON.parse(services_buffer) as Array<ServiceInfo>;
            console.log(services_json);
            resolve(services_json);
        });
    }
}