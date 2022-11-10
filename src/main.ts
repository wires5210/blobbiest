import { Composite, Heax, Particle } from 'heax'
import {
    Text,
    Application,
    Mesh,
    Shader,
    Container,
    Texture,
    Geometry,
} from 'pixi.js'
import { pixiJsFragmentShader, pixiJsVertexShader } from './defaultShaders'

let particleCount = 0
const outerRing: number[] = []
const innerRing: number[] = []
let centerParticle: Particle | undefined

const segmentCount = 15
let centerTargetX = 0
let centerTargetY = 0
let dragging = false
const baseGravity = 0.1
let gravityAngle = Math.PI * 1.5

const offsetX = 64
const offsetY = 64
const scaleX = 1
const scaleY = 1
const imgWidth = 266
const imgHeight = 189
function addPoint(composite: Composite, x: number, y: number): void {
    composite.addParticle(x * scaleX, y * scaleY, x * scaleX, y * scaleY, {
        radius: 2,
    })
    particleCount += 1
}

function oval(
    composite: Composite,
    x: number,
    y: number,
    width: number,
    height: number,
    segments: number
): void {
    const step = (Math.PI * 2) / segments
    const innerRingDistance = 32
    for (let i = 0; i < Math.PI * 2 - 0.005; i += step) {
        const pointX = Math.cos(i) * width + x
        let pointY = Math.sin(i) * height + y
        const squishLimit = y + height * 0.5
        if (pointY > squishLimit) {
            pointY = squishLimit + (pointY - squishLimit) * 0.2
        }
        addPoint(composite, pointX, pointY)
        outerRing.push(particleCount - 1)
        // addPoint(composite, (pointX - x) * innerRingScale + x, (pointY - y) * innerRingScale + y)
        const distance = Math.sqrt(
            Math.pow(pointX - x, 2) + Math.pow(pointY - y, 2)
        )
        const innerX =
            ((pointX - x) * (distance - innerRingDistance)) / distance + x
        const innerY =
            ((pointY - y) * (distance - innerRingDistance)) / distance + y
        addPoint(composite, innerX, innerY)
        innerRing.push(particleCount - 1)
    }
}

function heaxSetup(canvas: HTMLCanvasElement): Heax {
    const heax = new Heax(canvas)
    heax.friction = 0.975
    heax.bounce = 1
    heax.groundFriction = 0.99

    const cat = new Composite(heax)
    const x = imgWidth / 2 + 5
    const y = imgHeight / 2 + 15
    const width = imgWidth / 2 + 20
    const height = imgHeight / 2 + 40
    const segments = segmentCount
    oval(cat, x + offsetX, y + offsetX, width, height, segments)

    for (let i = 0; i < outerRing.length; i++) {
        const outer = outerRing[i]
        const inner = innerRing[i]
        cat.addConstraint(outer, inner, {
            stiffness: 0.5,
        })
    }

    for (let i = 0; i < outerRing.length; i++) {
        const outer = outerRing[i]
        const inner = innerRing[(i + 1) % outerRing.length]
        cat.addConstraint(outer, inner, {
            stiffness: 0.25,
        })
    }

    for (let i = 0; i < innerRing.length; i++) {
        const inner = innerRing[i]
        const outer = outerRing[(i + 1) % outerRing.length]
        cat.addConstraint(inner, outer, {
            stiffness: 0.25,
        })
    }

    for (let i = 0; i < outerRing.length; i++) {
        const prev = outerRing[i]
        const next = outerRing[(i + 1) % outerRing.length]
        cat.addConstraint(prev, next, {
            stiffness: 3,
        })
    }

    for (let i = 0; i < innerRing.length; i++) {
        const prev = innerRing[i]
        const next = innerRing[(i + 1) % innerRing.length]
        cat.addConstraint(prev, next, {
            stiffness: 1,
        })
    }

    for (let i = 0; i < innerRing.length; i++) {
        const prev = innerRing[i]
        const next = innerRing[(i + 2) % innerRing.length]
        cat.addConstraint(prev, next, {
            stiffness: 1,
        })
    }

    const center = cat.addParticle(
        x + offsetX - 10,
        y + offsetY,
        x + offsetX - 10,
        y + offsetY,
        {
            radius: 5,
        }
    )

    centerParticle = center

    for (let i = 0; i < innerRing.length; i++) {
        const inner = innerRing[i]
        cat.addConstraint(center, inner, {
            stiffness: 0.015,
        })
    }

    heax.composites.push(cat)

    //@ts-expect-error mmmmmmmm
    window.heax = heax
    //@ts-expect-error mmmmmmmm
    window.u = (): void => {
        let r = ''
        for (const particle of cat.particles) {
            r += `addPoint(cat, ${particle.position.x}, ${particle.position.y})\n`
        }
        console.log(r)
        heax.update()
    }

    return heax
}

function meshSetup(cat: Composite): Mesh<Shader> {
    const kittyTexture = Texture.from('kbhd.png')

    const uniforms = {
        uSampler: kittyTexture,
    }
    const shader = Shader.from(
        pixiJsVertexShader,
        pixiJsFragmentShader,
        uniforms
    )

    const vertices: number[] = []
    const uvs: number[] = []
    if (!centerParticle) throw new Error('wtf')
    vertices.push(centerParticle.position.x, centerParticle.position.y)
    uvs.push(0.5, 0.5)

    outerRing.forEach(i => {
        const particle = cat.particles[i]
        vertices.push(particle.position.x, particle.position.y)
    })

    outerRing.forEach(i => {
        const particle = cat.particles[i]
        uvs.push(
            (particle.position.x - offsetX) / imgWidth,
            (particle.position.y - offsetX) / imgHeight
        )
    })

    const indices: number[] = []
    for (let i = 0; i < outerRing.length; i++) {
        indices.push(0, i + 1, ((i + 1) % outerRing.length) + 1)
    }

    const catMeshGeometry = new Geometry()

    catMeshGeometry.addAttribute(
        'aVertexPosition',
        new Float32Array(vertices),
        2
    )
    catMeshGeometry.addAttribute('aTextureCoord', new Float32Array(uvs), 2)
    catMeshGeometry.addIndex(new Uint16Array(indices))

    return new Mesh(catMeshGeometry, shader)
}

window.onload = (): void => {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement
    const ctx = canvas.getContext('webgl')
    if (!ctx) {
        throw new Error('what how')
    }

    const heax = heaxSetup(canvas)
    const cat = heax.composites[0]
    const catMesh = meshSetup(cat)
    const catMeshGeometry = catMesh.geometry
    const app = new Application({
        width: 800,
        height: 600,
        resizeTo: window,
        backgroundColor: 0x1099bb,
        view: canvas,
    })

    const container = new Container()
    app.stage.addChild(container)

    container.addChild(catMesh)

    let accelerometerX = 0
    let accelerometerY = 0

    const onDeviceMotion = (e: DeviceMotionEvent): void => {
        console.log('motion !!!!!!!')
        const accel = e.accelerationIncludingGravity
        if (accel == null) return
        if (accel.x) accelerometerX = accel.x
        if (accel.y) accelerometerY = accel.y
        console.log(accelerometerX, accelerometerY)
    }

    const iosGetAccelerometer = (): void => {
        console.log('hmm?')
        // @ts-expect-error ios stuff mmmm
        window.DeviceMotionEvent.requestPermission().then(response => {
            if (response === 'granted') {
                console.log('lets goooooooooo')
            }
        })

        canvas.removeEventListener('touchend', iosGetAccelerometer)
        window.addEventListener('devicemotion', onDeviceMotion)
    }

    if ('requestPermission' in window.DeviceMotionEvent) {
        canvas.addEventListener('touchend', iosGetAccelerometer)
    } else {
        window.addEventListener('devicemotion', onDeviceMotion)
    }

    app.ticker.add(() => {
        let gravityMultiplier = 1
        if (dragging) {
            gravityMultiplier = 0
            if (!centerParticle) throw new Error('wtf')
            // move central particle toward centerTarget
            // limit movement to a certain distance to avoid moving too fast
            const dx = centerTargetX - centerParticle.position.x
            const dy = centerTargetY - centerParticle.position.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > 0) {
                const maxDist = 7
                const scale = Math.min(dist, maxDist) / dist
                centerParticle.position.x += dx * scale
                centerParticle.position.y += dy * scale
            }
        }

        if (accelerometerX != 0 || accelerometerY != 0) {
            gravityAngle = Math.atan2(accelerometerY, accelerometerX) + Math.PI
        }
        heax.gravity.x =
            Math.cos(gravityAngle) * baseGravity * gravityMultiplier
        heax.gravity.y =
            -Math.sin(gravityAngle) * baseGravity * gravityMultiplier

        heax.update()

        const newVertices: number[] = []

        heax.width = app.view.width
        heax.height = app.view.height
        if (!centerParticle) throw new Error('wtf')
        newVertices.push(centerParticle.position.x, centerParticle.position.y)

        outerRing.forEach(i => {
            const particle = cat.particles[i]
            newVertices.push(particle.position.x, particle.position.y)
        })

        const vertexBuffer = catMeshGeometry.getBuffer('aVertexPosition')
        vertexBuffer.data = new Float32Array(newVertices)
        vertexBuffer.update()
    })

    if (!app.view.addEventListener) throw new Error('what !!!!!!!!')
    const onPressDown = (): void => {
        console.log('down :]')
        centerTargetX = centerParticle?.position.x
        centerTargetY = centerParticle?.position.y
        dragging = true
    }

    const onPressUp = (): void => {
        console.log('up [:')
        dragging = false
    }

    const onPressMove = (dx: number, dy: number): void => {
        if (dragging) {
            if (!centerParticle) throw new Error('wtf')
            centerTargetX += dx
            centerTargetY += dy
        }
    }

    app.view.addEventListener('mousedown', onPressDown)
    app.view.addEventListener('mouseup', onPressUp)

    //@ts-expect-error it's a MouseEvent !!!! why aren't you letting me declare it as a MouseEvent !!!!!!! :[
    app.view.addEventListener('mousemove', (e: MouseEvent) => {
        onPressMove(e.movementX, e.movementY)
    })

    let prevTouchX: number | undefined
    let prevTouchY: number | undefined

    //@ts-expect-error ditto
    app.view.addEventListener('touchstart', (e: TouchEvent) => {
        const touch = e.touches[0]
        prevTouchX = touch.clientX
        prevTouchY = touch.clientY
        onPressDown()
    })
    app.view.addEventListener('touchend', e => {
        prevTouchX = undefined
        prevTouchY = undefined
        onPressUp()
    })

    const text = new Text(
        'press and drag to move\ntilt your phone to change gravity',
        {
            fontSize: 32,
            align: 'left',
        }
    )

    container.addChild(text)

    //@ts-expect-error ditto
    app.view.addEventListener('touchmove', (e: TouchEvent) => {
        if (!prevTouchX || !prevTouchY) return
        e.preventDefault()
        const touch = e.touches[0]
        const dx = touch.clientX - prevTouchX
        const dy = touch.clientY - prevTouchY
        prevTouchX = touch.clientX
        prevTouchY = touch.clientY
        onPressMove(dx, dy)
    })
}
