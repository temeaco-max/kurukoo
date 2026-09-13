const deviceTemplates = {
    'samsung_tv': {
        name: 'Samsung Smart TV',
        commands: {
            power: { type: 'http', path: '/api/v2/remote/control?action=power', method: 'POST', label: 'Power' },
            volume_up: { type: 'http', path: '/api/v2/remote/control?action=vol_up', method: 'POST', label: 'Vol +' },
            volume_down: { type: 'http', path: '/api/v2/remote/control?action=vol_down', method: 'POST', label: 'Vol -' },
            channel_up: { type: 'http', path: '/api/v2/remote/control?action=ch_up', method: 'POST', label: 'CH +' },
            channel_down: { type: 'http', path: '/api/v2/remote/control?action=ch_down', method: 'POST', label: 'CH -' },
        }
    },
    'lg_tv': {
        name: 'LG WebOS TV',
        commands: {
            power: { type: 'http', path: '/roap/api/command', method: 'POST', payload: 'power', label: 'Power' }, // Simplified mock
            volume_up: { type: 'http', path: '/roap/api/command', method: 'POST', payload: 'volume_up', label: 'Vol +' },
            volume_down: { type: 'http', path: '/roap/api/command', method: 'POST', payload: 'volume_down', label: 'Vol -' }
        }
    },
    'roku': {
        name: 'Roku',
        commands: {
            power: { type: 'http', path: '/keypress/Power', method: 'POST', label: 'Power' },
            home: { type: 'http', path: '/keypress/Home', method: 'POST', label: 'Home' },
            volume_up: { type: 'http', path: '/keypress/VolumeUp', method: 'POST', label: 'Vol +' },
            volume_down: { type: 'http', path: '/keypress/VolumeDown', method: 'POST', label: 'Vol -' },
        }
    },
    'android_tv': {
        name: 'Android TV',
        commands: {
            power: { type: 'http', path: '/api/v1/key/power', method: 'POST', label: 'Power' },
            select: { type: 'http', path: '/api/v1/key/center', method: 'POST', label: 'Select' },
            back: { type: 'http', path: '/api/v1/key/back', method: 'POST', label: 'Back' }
        }
    },
    'tp_link_plug': {
        name: 'TP-Link Smart Plug',
        commands: {
            on: { type: 'http', path: '/?action=on', method: 'POST', label: 'On' },
            off: { type: 'http', path: '/?action=off', method: 'POST', label: 'Off' }
        }
    },
    'sonoff_plug': {
        name: 'Sonoff Smart Plug',
        commands: {
            toggle: { type: 'mqtt', topic: 'cmnd/sonoff/POWER', payload: 'TOGGLE', label: 'Toggle' },
            on: { type: 'mqtt', topic: 'cmnd/sonoff/POWER', payload: 'ON', label: 'On' },
            off: { type: 'mqtt', topic: 'cmnd/sonoff/POWER', payload: 'OFF', label: 'Off' },
            timer_2h: { type: 'mqtt', topic: 'cmnd/sonoff/Timer', payload: '2h', label: 'Timer 2h' }
        }
    }
};

window.executeDeviceCommand = async function(deviceConfig, commandKey) {
    const cmd = deviceTemplates[deviceConfig.type]?.commands[commandKey];
    if (!cmd) {
        console.error('Command not found', commandKey);
        return;
    }
    
    // For MQTT we pass the topic & payload
    // For HTTP we pass the IP and path
    
    const reqBody = {
        protocol: cmd.type,
        ip: deviceConfig.ip,
        topic: cmd.topic,
        payload: cmd.payload,
        path: cmd.path,
        method: cmd.method
    };
    
    try {
        const res = await fetch('/api/iot/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody)
        });
        const data = await res.json();
        if (data.success) {
            console.log('Command executed successfully');
        } else {
            console.error('Command failed', data.error);
        }
    } catch (e) {
        console.error('Network error executing command', e);
    }
};
