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
let centerParticle: Particle | undefined
let anchorParticle: Particle | undefined

const segmentCount = 20
let centerTargetX = 0
let centerTargetY = 0
let dragging = false
const baseGravity = 0.2
let gravityAngle = Math.PI * 1.5

const offsetX = 64
const offsetY = 64
const centerOffsetX = -20
const centerOffsetY = 10
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
    for (let i = 0; i < Math.PI * 2 - 0.005; i += step) {
        const pointX = Math.cos(i) * width + x
        let pointY = Math.sin(i) * height + y
        const squishLimit = y + height * 0.5
        if (pointY > squishLimit) {
            pointY = squishLimit + (pointY - squishLimit) * 0.2
        }
        addPoint(composite, pointX, pointY)
        outerRing.push(particleCount - 1)
    }
}

function heaxSetup(canvas: HTMLCanvasElement): Heax {
    const heax = new Heax(canvas)
    heax.friction = 0.985
    heax.bounce = 0
    heax.groundFriction = 1

    const cat = new Composite(heax)
    const x = imgWidth / 2 + 5
    const y = imgHeight / 2 + 15
    const width = imgWidth / 2 + 20
    const height = imgHeight / 2 + 40
    const segments = segmentCount
    oval(cat, x + offsetX, y + offsetX, width, height, segments)

    for (let i = 0; i < outerRing.length; i++) {
        const outer = outerRing[i]
        const next1 = outerRing[(i + 1) % outerRing.length]
        const next2 = outerRing[(i + 2) % outerRing.length]
        cat.addConstraint(outer, next1, {
            stiffness: 0.7,
        })
        cat.addConstraint(outer, next2, {
            stiffness: 0.7,
        })
    }

    const center = cat.addParticle(
        x + offsetX + centerOffsetX,
        y + offsetY + centerOffsetY,
        x + offsetX + centerOffsetX,
        y + offsetY + centerOffsetY,
        {
            radius: 5,
        }
    )

    centerParticle = center
    anchorParticle = cat.addParticle(
        centerParticle.position.x + 1, // + 1 to avoid NaNs
        centerParticle.position.y,
        centerParticle.oldPosition.x,
        centerParticle.oldPosition.y,
        {
            radius: 3,
        }
    )

    cat.addConstraint(center, anchorParticle, {
        stiffness: 0.1,
    })

    for (let i = 0; i < outerRing.length; i++) {
        const outer = outerRing[i]
        const constraint = cat.addConstraint(outer, center, {
            stiffness: 0.09,
            width: 1,
        })
        if (constraint.distance >= 120) {
            constraint.stiffness = 0.09 - (constraint.distance - 120) * 0.00075
            constraint.width = 3
        }
    }

    heax.composites.push(cat)
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
    uvs.push(0.5 + centerOffsetX / imgWidth, 0.5 + centerOffsetY / imgHeight)

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
        const accel = e.accelerationIncludingGravity
        if (accel == null) return
        if (accel.x) accelerometerX = accel.x
        if (accel.y) accelerometerY = accel.y
    }

    const iosGetAccelerometer = (): void => {
        console.log('hmm?')
        // @ts-expect-error ios stuff mmmm
        window.DeviceMotionEvent.requestPermission().then(response => {
            if (response === 'granted') {
                console.log('lets goooooooooo')
                window.addEventListener('devicemotion', onDeviceMotion)
            }
            canvas.removeEventListener('touchend', iosGetAccelerometer)
        })
    }

    if ('requestPermission' in window.DeviceMotionEvent) {
        canvas.addEventListener('touchend', iosGetAccelerometer)
    } else {
        window.addEventListener('devicemotion', onDeviceMotion)
    }

    app.ticker.add(() => {
        if (!anchorParticle) throw new Error('wtf')

        let gravityMultiplier = 1
        if (dragging) {
            gravityMultiplier = 0
            // move the anchorParticle, which in turn
            // causes centerParticle to move
            // if centerParticle is moved directly,
            // the face won't look as jelly-like ]:
            const dx = centerTargetX - anchorParticle.position.x
            const dy = centerTargetY - anchorParticle.position.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > 0) {
                const maxDist = 7
                const scale = Math.min(dist, maxDist) / dist
                anchorParticle.position.x += dx * scale
                anchorParticle.position.y += dy * scale
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
        newVertices.push(anchorParticle.position.x, anchorParticle.position.y)

        outerRing.forEach(i => {
            const particle = cat.particles[i]
            newVertices.push(particle.position.x, particle.position.y)
        })

        const vertexBuffer = catMeshGeometry.getBuffer('aVertexPosition')
        vertexBuffer.data = new Float32Array(newVertices)
        vertexBuffer.update()
    })

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

    if (!app.view.addEventListener) throw new Error('what !!!!!!!!')
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
    app.view.addEventListener('touchend', () => {
        prevTouchX = undefined
        prevTouchY = undefined
        onPressUp()
    })

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

    const text = new Text(
        'press and drag to move\ntilt your phone to change gravity',
        {
            fontSize: 32,
            align: 'left',
        }
    )

    container.addChild(text)
}
