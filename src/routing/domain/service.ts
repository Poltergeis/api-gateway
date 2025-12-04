export type ServiceInfo = {
    id: string,
    gateway_prefix: string,
    target_service: TargetService,
    timeouts: TimeoutInfo,
    routes: Array<Route>
}

type TargetService = {
    host_var: string,
    base_path: string
}

type TimeoutInfo = {
    connect_ms: number,
    read_ms: number
}

type Route = {
    route: string,
    methods: Array<string>,
    auth_required: boolean
}