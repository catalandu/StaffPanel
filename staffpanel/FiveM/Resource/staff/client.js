onNet('Scotty:Client:WarnPlayer', (reason) => {
    SendNuiMessage(JSON.stringify({
        warning: reason
    }))
})

onNet('Scotty:Client:CommendPlayer', (reason) => {
    SendNuiMessage(JSON.stringify({
        success: reason
    }))
})