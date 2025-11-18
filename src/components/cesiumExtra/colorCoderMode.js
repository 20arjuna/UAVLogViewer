import { Color } from 'cesium'

export default class ColorCoderMode {
    requiredMessages = []

    constructor (state) {
        this.state = state
    }

    getLegend () {
        const legend = []
        for (const mode of this.setOfModes) {
            legend.push({
                name: mode,
                color: this.state.cssColors[this.setOfModes.indexOf(mode)]
            })
        }
        return legend
    }

    getColor (time) {
        if (this.setOfModes === undefined) {
            this.setOfModes = this.calculateSetOfModes()
        }
        const colorObj = this.state.colors[this.setOfModes.indexOf(this.getMode(time))]
        // Convert plain object to Cesium.Color
        return new Color(colorObj.r, colorObj.g, colorObj.b, colorObj.a)
    }

    getMode (time) {
        let previousMode = this.state.flightModeChanges[0][1]
        for (const mode of this.state.flightModeChanges) {
            if (mode[0] > time) {
                return previousMode
            }
            previousMode = mode[1]
        }
        return this.state.flightModeChanges[this.state.flightModeChanges.length - 1][1]
    }

    calculateSetOfModes () {
        const set = []
        for (const mode of this.state.flightModeChanges) {
            if (!set.includes(mode[1])) {
                set.push(mode[1])
            }
        }
        return set
    }
}
