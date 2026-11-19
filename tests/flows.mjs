const a=(kind,value)=>({kind,...(value===undefined?{}:{value})});
const repeat=(kind,count)=>Array.from({length:count},()=>a(kind));
export const flows={
 dcs:[a('backup'),a('auto'),a('setpoint',60),...repeat('scan',4),a('primary')],
 cnc:[a('guard'),a('home'),a('program'),a('start'),a('estop'),a('estop'),a('home'),a('start'),...repeat('step',3)],
 'hmi-alarms':[a('heat'),a('ack'),a('cool'),a('reset')],
 'scada-trends':[a('level'),a('poll'),a('level'),a('poll'),a('level'),a('poll'),a('link'),a('poll'),a('link'),a('poll'),a('history')],
 engineering:[a('connect'),a('backup'),a('edit'),a('download'),...repeat('record',3),a('restore')],
 'sensor-calibration':[a('capture'),a('reference'),a('capture'),a('calibrate'),a('test')],
 actuator:[a('air'),a('command',100),...repeat('step',4),a('command',50),a('jam'),a('step'),a('jam'),...repeat('step',2)],
 generator:[a('start'),a('breaker'),...repeat('load',2),a('unload'),a('breaker'),a('stop')],
 'conveyor-safety':[a('guard'),a('start'),a('guard'),a('guard'),a('reset'),a('start'),...repeat('step',4)],
 turbine:[a('lube'),a('steam',50),...repeat('step',2),a('steam',100),...repeat('step',2),a('reset')],
 gateway:[a('protocol'),a('map'),a('read'),a('publish'),a('uplink'),a('publish'),a('uplink'),a('publish')],
 'industrial-network':[a('segment'),a('policy'),a('test'),a('logs')]
};
export const bypasses={dcs:[a('auto'),a('primary')],cnc:[a('start'),a('step')],'hmi-alarms':[a('heat'),a('ack'),a('reset')],'scada-trends':[a('history')],engineering:[a('download'),a('restore')],'sensor-calibration':[a('test'),a('calibrate')],actuator:[a('command',100),a('step')],generator:[a('load'),a('stop')],'conveyor-safety':[a('start'),a('step')],turbine:[a('steam',100),a('step')],gateway:[a('publish')],'industrial-network':[a('test'),a('logs')]};
