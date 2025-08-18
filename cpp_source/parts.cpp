/***********************************************************************
 *	d:/Werk/src/csmash-0.3.8.new/conv/parts.cpp
 *	$Id$
 *
 *	Copyright by ESESoft.
 *
 *	Redistribution and use in source and binary forms, with or without
 *	modification, are permitted provided that the following conditions
 *	are met:
 *
 *	Redistributions of source code must retain the above copyright
 *	notice, this list of conditions and the following disclaimer.
 *
 *	Redistributions in binary form must reproduce the above copyright
 *	notice, this list of conditions and the following disclaimer
 *	in the documentation and/or other materials provided with the
 *	distribution.
 *
 *	The name of the author may not be used to endorse or promote
 *	products derived from this software without specific prior written
 *	permission.
 *
 *	THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS
 *	OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 *	ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 *	DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 *	DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *	GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 *	INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *	WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *	NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 *	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 ***********************************************************************/

#include "ttinc.h"
#include "LoadImage.h"
#include "glARB.h"

//extern PFNGLACTIVETEXTUREARBPROC glActiveTextureARB;
//extern PFNGLMULTITEXCOORD1FARBPROC glMultiTexCoord1fARB;

#include <iostream>
#include <vector>
#include <map>
#include <list>
#include <algorithm>

#include "float"
#include "matrix"
#include "affine"

#include "parts.h"

#include "RCFile.h"
extern RCFile *theRC;
extern bool initanimelight();
extern void uninitanimelight();
extern GLuint tex_animelight;


#define RENDEREDGE 0

#define LSHOULDERORIGINX	-0.2
#define LSHOULDERORIGINY	0.0
#define LSHOULDERORIGINZ	1.30
#define RSHOULDERORIGINX	0.2
#define RSHOULDERORIGINY	0.0
#define RSHOULDERORIGINZ	1.30

#define NECKORIGINX	0.0
#define NECKORIGINY	0.0
#define NECKORIGINZ	1.30
#define WAISTORIGINX	0.0
#define WAISTORIGINY	-0.16
#define WAISTORIGINZ	0.77

#define RHIPORIGINX	0.1
#define RHIPORIGINY	-0.16
#define RHIPORIGINZ	0.77
#define LHIPORIGINX	-0.1
#define LHIPORIGINY	-0.16
#define LHIPORIGINZ	0.77
#define RFOOTORIGINX	0.25
#define RFOOTORIGINY	0
#define RFOOTORIGINZ	0
#define LFOOTORIGINX	-0.25
#define LFOOTORIGINY	0
#define LFOOTORIGINZ	0


const float thighLength = 0.396;
const float shinLength = 0.430;
const float footSize = 0.15;
const float bodylength = 0.539;

#include "BaseView.h"

// for(;;) namescoping hack.
// VC++ 6 is not compliant with latest ANSI C++ (but VC++7 does).
#if defined(_MSC_VER) && (_MSC_VER <= 1200)
# define for if(0);else for
#endif
#define elif else if

#define BEGIN_ANONYMOUS namespace {
#define END_ANONYMOUS }
/***********************************************************************
 *	Local data and functions
 ***********************************************************************/
BEGIN_ANONYMOUS

inline bool streq(const char *a, const char *b)
{
    return 0 == strcmp(a, b);
}

template <typename T>
inline bool between(const T& a, const T& x, const T& b) {
    return a <= x && x <= b;
}

template <typename T>
inline const T& clamp(const T& a, const T& x, const T& b) {
    if (a > x) return a;
    elif (b < x) return b;
    else return x;
}

struct plane_t {
    short poly[4];
    short cindex;

    inline short& operator [](int i) { return poly[i]; }
    inline int size() const { return (poly[3] < 0) ? 3 : 4; }
};
END_ANONYMOUS

/***********************************************************************
 *	Class colormap
 ***********************************************************************/
bool colormap::load(const char *file)
{
    fill(color_t(128,128,128));
    FILE *fp = fopen(file, "r");
    if (!fp) return false;
    do {
	char line[1024];
	const char *delim = " \t,;()\r\n";
	fgets(line, 1024, fp);
	if (feof(fp)) break;
	char *token = strtok(line, delim);
	if (!token || '#' == *token) continue;
	int num = atoi(token);
	int r = atoi(strtok(NULL, delim));
	int g = atoi(strtok(NULL, delim));
	int b = atoi(strtok(NULL, delim));
	token = strtok(NULL, delim);
	int a = (token && '#' != *token) ? atoi(token) : 127;

	if (0 > num) {
	    fill(color_t(r, g, b, a));
	} else {
	    map[clamp(0, num, map_size-1)] = color_t(r, g, b, a);
	}
    } while (!ferror(fp));
    fclose(fp);
    return true;
}

/***********************************************************************
 *	Class polyhedron
 ***********************************************************************/
polyhedron::polyhedron(const char* filename)
  : numPoints(0), numPolygons(0), numEdges(0),
    points(NULL), texcoord(NULL), polygons(NULL),
    cindex(NULL), normals(NULL), planeNormal(NULL), edges(NULL),
    filename(strdup(filename))
{
    FILE *in = fopen(filename, "r");
    if (NULL == in) return;

    std::vector<vector3F> vertex(1000);
    std::vector<vector3F> st(1000);
    std::vector<plane_t> loop(1000);

    initColormap();

    char line[512];
    const char *delim = " \t(,);\r\n";

    bool textureexists = false;
    while (NULL != fgets(line, sizeof(line), in)) {
	char *token = strtok(line, delim);
	if (!token) continue;
	if (streq("point", token)) {
	    int num = atoi(strtok(NULL, delim));
	    if ((int)vertex.capacity() <= numPoints) {
		printf(_("%s:%d vertex buffer overflow\n"), __FILE__, __LINE__);
		exit(5);
	    }
	    vector3F v;
	    v[0] = (float)strtod(strtok(NULL, delim), NULL);
	    v[1] = (float)strtod(strtok(NULL, delim), NULL);
	    v[2] = (float)strtod(strtok(NULL, delim), NULL);
	    vertex[numPoints] = v;
	    vector3F t(0);
	    token = strtok(NULL, delim);
	    if (token) {
		textureexists = true;
		t[0] = (float)strtod(token, NULL);
		t[1] = 1-(float)strtod(strtok(NULL, delim), NULL);
		if (t[0] < 1e-5) t[0] = 0;
		if (t[1] < 1e-5) t[1] = 0;
	    }
	    st[numPoints] = t;

	    numPoints++;
	}
	elif (streq("plane", token)) {
	    int i = 0;
	    if ((int)loop.capacity() <= numPolygons) {
		printf(_("%s:%d loop buffer overflow\n"), __FILE__, __LINE__);
		exit(5);
	    }
	    plane_t &f = loop[numPolygons];
	    f[3] = -1;
	    f.cindex = 0;
	    while (NULL != (token = strtok(NULL, delim))) {
		if ('#' == *token) break;
		elif (isalpha(*token)) {
                    if ('C' == *token) f.cindex = atoi(token+1);
                }
		elif (isdigit(*token) && 4 > i) f[i++] = atoi(token);
	    }
	    numPolygons++;
	}
    }
    fclose(in);

    points = new vector3F[numPoints];
    polygons = new short[numPolygons][4];
    normals = new vector3F[numPolygons][4];
    planeNormal = new vector3F[numPolygons];
    cindex = new unsigned char[numPolygons];
    if (textureexists) {
	texcoord = new vector3F[numPoints];
        std::copy(&st[0], &st[numPoints], texcoord);
    }

    int i;
    std::copy(&vertex[0], &vertex[numPoints], points);

    for (i = 0; numPolygons > i; i++) {
	cindex[i] = loop[i].cindex;
	for (int j = 0; 4 > j; j++) {
	    polygons[i][j] = loop[i][j];
	}
    }
//    getNormal();
}

polyhedron::~polyhedron()
{
    delete[] points;
    delete[] polygons;
    delete[] cindex;
    delete[] normals;
    delete[] planeNormal;
    delete[] edges;
    delete[] texcoord;
    if (filename) free((void*)filename);
}

void polyhedron::initColormap()
{
    typedef colormap::color_t color_t;
    cmap.fill(color_t(128));	// default to be gray

    cmap[0] = color_t(250, 188, 137);	// C0 skin
    cmap[1] = color_t(1);		// C1 eye
    cmap[2] = color_t(42, 19, 5);	// C2 hair
    cmap[3] = color_t(250, 188, 137);	// C3 skin
//    cmap[4] = color_t(225, 7, 47);	// C4 shirts (red)
    cmap[4] = color_t(3, 87, 125);	// C4 shirts (blue)
//    cmap[5] = color_t(2, 13, 24);	// C5 pants  (green)
    cmap[5] = color_t(0);		// C5 pants  (black)
    cmap[6] = color_t(102, 7, 3);	// C6 skin/shadow
    cmap[7] = color_t(255, 0, 0);	// C7 racket/front
    cmap[8] = color_t(0);		// C8 racket/back
}

// normal vectors are destroyed
polyhedron& polyhedron::operator *=(const affine4F& m)
{
    for (int i = 0; numPoints > i; ++i) points[i] = points[i] * m;
    return *this;
}

/***********************************************************************
 *	CreateNormal
 *	Creates normal vector for each points of polygons.
 *	You should note that "each points" and "each points of polygons"
 *	are not same.
 *
 *	Normal vectors for polygon_ are returned to corresponding normal_,
 *	i.e. normal vector for polygon_[1][2] is returned to normal_[1][2].
 *
 *	This function will work on polyhedron that is NOT a 2-manifold.
 ***********************************************************************/
// MERGELIMIT = cos(angle).
#define MERGELIMIT Float(0.5)

BEGIN_ANONYMOUS
inline short round(short v, int len) { return (v + len) % len; }
inline int length(const short poly[4]) { return (0 <= poly[3]) ? 4 : 3; }

int find(const short poly[4], short p) {
    int l = length(poly);
    for (int i = 0; l > i; i++) {
        if (poly[i] == p) return i;
    }
    return -1;
}

inline unsigned long key(short v0, short v1) {
    unsigned long k = v0;
    return (k << 16) | (v1);
}

struct halfedge {
    short v0, v1;
    short poly;

    inline halfedge() {}
    inline halfedge(short v0, short v1, short poly)
      : v0(v0), v1(v1), poly(poly) {}
    inline halfedge(const halfedge &e)
      : v0(e.v0), v1(e.v1), poly(e.poly) {}
};
END_ANONYMOUS

void polyhedron::getNormal()
{
    int i, j;
    for (i = 0, j = 0; numPolygons > j; j++) {
	i += length(polygons[j]);
    }
    const int nhalfedges = i;
    std::vector<halfedge> hearray(nhalfedges);

    typedef std::map<unsigned long, const halfedge*> hemap_t;
    hemap_t hemap;

    for (i = 0, j = 0; numPolygons > j; j++) {
	int l = length(polygons[j]);
	for (int k = 0; l > k; k++) {
	    short v0 = polygons[j][k];
	    short v1 = polygons[j][round(k+1, l)];
	    hearray[i] = halfedge(v0, v1, j);
	    hemap[key(v0, v1)] = &hearray[i];
	    i++;
	}
    }

    for (i = 0; numPolygons > i; i++) {
	int l = length(polygons[i]);
	for (int k = 0; k < l; k++) {
	    short p0 = polygons[i][round(k-1, l)];
	    short p1 = polygons[i][k];
	    short p2 = polygons[i][round(k+1, l)];

	    const vector3F &v0 = points[p0];
	    const vector3F &v1 = points[p1];
	    const vector3F &v2 = points[p2];

	    vector3F mn, sn;
	    mn = sn = ((v2-v1)^(v0-v1)).norm();

	    unsigned long mk = key(p1, p2);	// The key of origin halfedge.

	    int count = 8;
	    hemap_t::iterator x;

	    // forward traversal
	    do {
		x = hemap.find(key(p2, p1));
		if (hemap.end() == x) break;
		int poly = x->second->poly;
		int i;
		if (0 > (i = find(polygons[poly], p1))) break;
		int l = length(polygons[poly]);
		p0 = polygons[poly][round(i-1, l)];
		p2 = polygons[poly][round(i+1, l)];
		if (mk == key(p1, p2))
		    break;	// came back to origin halfedge

		const vector3F &v0 = points[p0];
		const vector3F &v1 = points[p1];
		const vector3F &v2 = points[p2];

		vector3F n = ((v2-v1)^(v0-v1)).norm();
		if (mn * n > MERGELIMIT) {
		    sn += n;
		}
	    } while (0 < count--); // avoid infinite loop

	    if (hemap.end() == x) {
		// backward traversal
		// (required if there is hole(s) near the halfedge)

		p0 = polygons[i][round(k-1,l)];
		p1 = polygons[i][k];
		p2 = polygons[i][round(k+1,l)];
		mk = key(p0, p1);
		do {
		    x = hemap.find(key(p1, p0));
		    if (hemap.end() == x) break;
		    int poly = x->second->poly;
		    int i;
		    if (0 > (i = find(polygons[poly], p1))) break;
		    int l = length(polygons[poly]);
		    p0 = polygons[poly][round(i-1, l)];
		    p2 = polygons[poly][round(i+1, l)];
		    if (mk == key(p1, p0))
			break; // came back to origin

		    const vector3F &v0 = points[p0];
		    const vector3F &v1 = points[p1];
		    const vector3F &v2 = points[p2];

		    vector3F n = ((v2-v1)^(v0-v1)).norm();
		    if (mn * n > MERGELIMIT) {
			sn += n;
		    }
		} while (0 < count--);
	    }
	    normals[i][k] = sn.norm();
	    planeNormal[i] = mn.norm();
	}
    }

    typedef std::list<edge> edgelist_t;

    edgelist_t el;
    while (hemap.size() > 0) {
	const halfedge &he = *hemap.begin()->second;
	hemap_t::iterator i = hemap.find(key(he.v1, he.v0));
	edge e;
	e.v0 = he.v0;
	e.v1 = he.v1;
	e.p0 = he.poly;
	if (hemap.end() != i) {
	    e.p1 = i->second->poly;
	    hemap.erase(i);
	} else {
	    e.p1 = -1;
	}
	hemap.erase(hemap.begin());
	el.push_back(e);
    }
    numEdges = el.size();
    if (!edges) edges = new edge[numEdges];
    std::copy(el.begin(), el.end(), &edges[0]);
}

/***********************************************************************
 *	Class
 ***********************************************************************/
affineanim::affineanim(int num)
  : numFrames(num)
{
    matrices = new affine4F[numFrames];
}

affineanim::affineanim(const char *filename)
  : numFrames(0), matrices(NULL)
{
    FILE *in = fopen(filename, "r");
    if (NULL == in) return;

    std::vector<affine4F> mat(400);

    char line[512];
    const char *delim = " \t(,);\r\n";
    while (NULL != fgets(line, sizeof(line), in)) {
	char *token = strtok(line, delim);
	if (!token) continue;
	if (streq("Affine3", token)) {
	    affine4F t(1);
	    for (int i = 0; 4 > i; i++) {
		for (int j = 0; 3 > j; j++) {
		    token = strtok(NULL, delim);
		    if (token) t[i][j] = (float)strtod(token, NULL);
		}
	    }
	    if ((int)mat.capacity() <= numFrames) {
		printf(_("%s:%d matrix buffer overflow\n"), __FILE__, __LINE__);
		exit(5);
	    }
	    mat[numFrames++] = t;
	}
    }
    fclose(in);
    matrices = new affine4F[numFrames];
    for (int i= 0; numFrames > i; i++) {
	matrices[i] = mat[i];
    }
}

affineanim::~affineanim()
{
    delete[] matrices;
}


quaternionanim::quaternionanim(int num)
  : numFrames(num)
{
  quaternions.resize(numFrames);
}

quaternionanim::quaternionanim(const char *filename)
  : numFrames(0)
{
    FILE *in = fopen(filename, "r");
    if (NULL == in) return;

    // Should be changed
    quaternions.resize(1000);

    char line[512];
    const char *delim = " \t(,);\r\n";
    while (NULL != fgets(line, sizeof(line), in)) {
	char *token = strtok(line, delim);
	if (!token) continue;
	if (streq("Origin", token)) {
	    vector3F v;
	    for (int i = 0; 3 > i; i++) {
	        token = strtok(NULL, delim);
		if (token) v[i] = strtod(token, NULL);
	    }
	    //printf( "%2.5f %2.5f %2.5f %2.5f\n", v[0], v[1], v[2], v[3] );
	    origin = v;
	    break;
	}
    }
    while (NULL != fgets(line, sizeof(line), in)) {
	char *token = strtok(line, delim);
	if (!token) continue;
	if (streq("Quaternion", token)) {
	    vector4F v;
	    for (int i = 0; 4 > i; i++) {
	        token = strtok(NULL, delim);
		if (token) v[i] = strtod(token, NULL);
	    }
	    //printf( "%2.5f %2.5f %2.5f %2.5f\n", v[0], v[1], v[2], v[3] );
	    v[0] = -v[0];
	    quaternions[numFrames++] = v;
	}
    }
    fclose(in);
}

quaternionanim::~quaternionanim()
{
}

/***********************************************************************
 *	Class affinemotion
 ***********************************************************************/
affinemotion::affinemotion(const char *refname, const char *animname)
  : ref(refname), anim(animname)
{
    ref.getNormal();    // create normal vectors of polyhedron
}

void
affinemotion::write(const char *basename)
{
    for (int i = 0; anim.numFrames > i; i++) {
	char buf[128];
	snprintf(buf, sizeof(buf), "%s%02d.dat", basename,i);
	FILE *fp = fopen(buf, "w");
	if (NULL == fp) exit(1);
	int j;
	for (j = 0; ref.numPoints > j; j++) {
	    vector3F v = ref.points[j] * anim.matrices[i];
	    fprintf(fp, "point %d,(%g,%g,%g);\n", j, v[0], v[1], v[2]);
	}
	for (j = 0; ref.numPolygons > j; j++) {
	    fprintf(fp, "plane ");
	    int k = 0;
	    while (k < 3) {
		fprintf(fp, "%d", ref.polygons[j][k]);
		if (2 != k) fprintf(fp, ",");
		k++;
	    }
	    if (ref.polygons[j][k] >= 0) {
		fprintf(fp, ",%d", ref.polygons[j][k]);
	    }
	    fprintf(fp, ";\n");
	}
	fclose(fp);
    }
}

/***********************************************************************
 *	Class quaternionmotion
 ***********************************************************************/
quaternionmotion::quaternionmotion(const char *refname, const char *animname)
  : ref(refname), anim(animname)
{
    ref.getNormal();    // create normal vectors of polyhedron
}


void
partsmotion::legIK( vector3F hip, vector3F &knee, vector3F &heel, vector3F toe,
		    float thighLength, float shinLength, float footSize,
		    bool isWireFrame ) {

  vector3F _hip, _knee, _heel, _toe;
  vector3F _heel2, _toe2;

  glPushMatrix();
  /* hip \xa4\xac\xb8\xb6\xc5\xc0\xa4\xcb\xcd\xe8\xa4\xeb\xa4褦ʿ\xb9԰\xdcư */
  glTranslatef(hip[0], hip[1], hip[2]);
  _hip  = hip - hip;
  _toe  = toe - hip;

  /* toe \xa4\xac yz ʿ\xcc̾\xe5\xa4\xcb\xcd\xe8\xa4\xeb\xa4褦y\xbc\xb4\xbc\xfe\xa4\xea\xa4ǲ\xf3ž */
  float rot1, rot2, rot3;
  if ( _toe[2] == 0.0 )
    rot1 = 0;
  else
    rot1 = -atan2( _toe[0], _toe[2] );

  /* \xb2\xf3ž\xb7׻\xbb */
  glRotatef( -rot1*180.0F/3.14159265, 0.0, 1.0, 0.0 );
  _toe = _toe*rotateY( rot1 );
  if ( _toe[1] < 0.0 ) {
    _toe[1] = -_toe[1];
    rot1 += 3.141592653589793238462;
  }

  //printf( "rot1: %f %f %f %f\n", rot1, _toe[0], _toe[1], _toe[2] );

  if ( thighLength+shinLength > hypot( _toe[1]-footSize, _toe[2] ) ) {
    /* \xec\xfb\xa4\xf2\xc3\xcf\xcc̤˲\xbc\xa4\xed\xa4\xb7, ɨ\xa4\xf2\xb6ʤ\xb2\xa4\xbf\xbe\xf5\xc2\xd6 */
    /* \xa4\xab\xa4\xab\xa4Ȥΰ\xcc\xc3֤\xf2\xb3\xce\xc4\xea */
    _heel[0] = 0;
    _heel[1] = _toe[1] - footSize;
    _heel[2] = _toe[2];

    /* \xa4\xab\xa4\xab\xa4Ȥ\xacz\xbc\xb4\xbe\xe5\xa4\xcb\xcd\xe8\xa4\xeb\xa4褦x\xbc\xb4\xbc\xfe\xa4\xea\xa4ǲ\xf3ž */
    if ( _heel[2] == 0.0 )
      rot2 = 0;
    else
      rot2 = atan2( _heel[1], _heel[2] );

    /* \xb7\xeb\xb2̤ϼ\xab\xcc\xc0\xa4ʤΤ\xc7, \xb2\xf3ž\xb7׻\xbb\xa4ϹԤ\xef\xa4ʤ\xa4 */
    glRotatef( -rot2*180.0F/3.14159265, 1.0, 0.0, 0.0 );

    //_heel2 = _heel*rotateX( rot2 );
    _toe2 = _toe*rotateX( rot2 );

    _heel2[0] = 0;
    _heel2[1] = 0;
    _heel2[2] = hypot( _heel[1], _heel[2] );

    //printf( "rot2: %f %f %f %f\n", rot2, _heel2[0], _heel2[1], _heel2[2] );

    /* \xb8\xf8\xbc\xb0\xa4\xe8\xa4\xea, ɨ\xa4ΰ\xcc\xc3֤\xf2\xb5\xe1\xa4\xe1\xa4\xeb */
    _knee[2] = (thighLength*thighLength-shinLength*shinLength+
		_heel2[2]*_heel2[2]) / (2*_heel2[2]);
    _knee[0] = 0;
    if ( thighLength*thighLength - _knee[2]*_knee[2] < 0 )
      _knee[1] = 0.0;
    else
      _knee[1] = sqrt(thighLength*thighLength - _knee[2]*_knee[2]);

    //printf( "_knee: %f %f %f\n", _knee[0], _knee[1], _knee[2] );
  } else {
    /* \xec\xfb\xa4\xf2\xbe夲, ɨ\xa4򿭤Ф\xb7\xa4\xbf\xbe\xf5\xc2\xd6 */
    /* \xc4\xde\xc0褬z\xbc\xb4\xbe\xe5\xa4\xcb\xcd\xe8\xa4\xeb\xa4褦x\xbc\xb4\xbc\xfe\xa4\xea\xa4ǲ\xf3ž */
    if ( _toe[2] == 0.0 )
      rot2 = 0;
    else
      rot2 = atan2( _toe[1], _toe[2] );

    /* \xb7\xeb\xb2̤ϼ\xab\xcc\xc0\xa4ʤΤ\xc7, \xb2\xf3ž\xb7׻\xbb\xa4ϹԤ\xef\xa4ʤ\xa4 */
    glRotatef( -rot2*180.0F/3.14159265, 1.0, 0.0, 0.0 );

    //_toe2 = _heel*rotateX( rot2 );
    //printf( "rot2: %f %f %f %f\n", rot2, _toe2[0], _toe2[1], _toe2[2] );

    _toe2[0] = 0;
    _toe2[1] = 0;
    _toe2[2] = hypot( _toe[1], _toe[2] );

    //printf( "rot2: %f %f %f %f\n", rot2, _toe2[0], _toe2[1], _toe2[2] );

    /* \xb8\xf8\xbc\xb0\xa4\xe8\xa4\xea, \xec\xfb\xa4ΰ\xcc\xc3֤\xf2\xb5\xe1\xa4\xe1\xa4\xeb */
    _heel2[2] = ((thighLength+shinLength)*(thighLength+shinLength)
		-footSize*footSize+_toe2[2]*_toe2[2]) / (2*_toe2[2]);
    _heel2[0] = 0;
    if ( (thighLength+shinLength)*(thighLength+shinLength)
	 -_heel2[2]*_heel2[2] < 0 )
      _heel2[1] = 0.0;
    else
      _heel2[1] = -sqrt((thighLength+shinLength)*(thighLength+shinLength)
			- _heel2[2]*_heel2[2]);

    //printf( "_knee: %f %f %f\n", _knee[0], _knee[1], _knee[2] );

    _knee[0] = 0;
    _knee[1] = _heel2[1]*thighLength/(thighLength+shinLength);
    _knee[2] = _heel2[2]*thighLength/(thighLength+shinLength);
  }

  /* \xb0ʲ\xbc, \xc9\xc1\xb2\xe8 */

  /* ɨ\xa4\xacz\xbc\xb4\xbe\xe5\xa4\xcb\xcd\xe8\xa4\xeb\xa4褦x\xbc\xb4\xbc\xfe\xa4\xea\xa4ǲ\xf3ž */
  if ( _knee[2] == 0.0 )
    rot3 = 0;
  else
    rot3 = atan2( _knee[1], _knee[2] );

  //printf( "rot3: %f\n", rot3 );

  _knee = _knee*rotateX( rot3 );
  _heel2 = _heel2*rotateX( rot3 );
  _toe2 = _toe2*rotateX( rot3 );

  glRotatef( -rot3*180.0F/3.14159265, 1.0, 0.0, 0.0 );

  renderparts(17, isWireFrame);

  /* ɨ\xa4\xac\xb8\xb6\xc5\xc0\xa4\xcb\xcd\xe8\xa4\xeb\xa4褦ʿ\xb9԰\xdcư */
  glTranslatef(_knee[0], _knee[1], _knee[2]);
  _heel2 -= _knee;
  _toe2 -= _knee;
  _knee -= _knee;

  /* \xec\xfb\xa4\xacz\xbc\xb4\xbe\xe5\xa4\xcb\xcd\xe8\xa4\xeb\xa4褦x\xbc\xb4\xbc\xfe\xa4\xea\xa4ǲ\xf3ž */
  float rot4;
  if ( _heel2[2] == 0.0 )
    rot4 = 0;
  else
    rot4 = atan2( _heel2[1], _heel2[2] );

  _heel2 = _heel2*rotateX( rot4 );
  _toe2 = _toe2*rotateX( rot4 );

  glRotatef( -rot4*180.0F/3.14159265, 1.0, 0.0, 0.0 );

  renderparts(18, isWireFrame);

  /* \xec\xfb\xa4\xac\xb8\xb6\xc5\xc0\xa4\xcb\xcd\xe8\xa4\xeb\xa4褦ʿ\xb9԰\xdcư */
  glTranslatef(_heel2[0], _heel2[1], _heel2[2]);
  _toe2 -= _heel2;
  _heel2 -= _heel2;

  /* \xc4\xde\xc0褬z\xbc\xb4\xbe\xe5\xa4\xcb\xcd\xe8\xa4\xeb\xa4褦x\xbc\xb4\xbc\xfe\xa4\xea\xa4ǲ\xf3ž */
  float rot5;
  if ( _toe2[2] == 0.0 )
    rot5 = 0;
  else
    rot5 = atan2( _toe2[1], _toe2[2] );

  _toe2 = _toe2*rotateX( rot5 );

  glRotatef( -rot5*180.0F/3.14159265, 1.0, 0.0, 0.0 );

  renderparts(19, isWireFrame);

  glPopMatrix();
}

void
partsmotion::drawleg( float xdiff, float ydiff, float zdiff,
		      bool isWireFrame = false ) {
    vector3F hip, knee, heel, toe;

    glPushMatrix();
    //glTranslatef( 0.0, WAISTORIGINY, 0.0 );
    hip[0] = RHIPORIGINX+xdiff;
    hip[1] = RHIPORIGINY+ydiff;
    hip[2] = RHIPORIGINZ+zdiff;
    toe[0] = RFOOTORIGINX;
    toe[1] = RFOOTORIGINY;
    toe[2] = RFOOTORIGINZ;

    legIK( hip, knee, heel, toe,
	   thighLength, shinLength, footSize, isWireFrame );

    hip[0] = LHIPORIGINX+xdiff;
    hip[1] = LHIPORIGINY+ydiff;
    hip[2] = LHIPORIGINZ+zdiff;
    toe[0] = LFOOTORIGINX;
    toe[1] = LFOOTORIGINY;
    toe[2] = LFOOTORIGINZ;

    legIK( hip, knee, heel, toe,
	   thighLength, shinLength, footSize, isWireFrame );
    glPopMatrix();
}


float bodyIK( vector3F &diff ) {
  float legLength = thighLength+shinLength+footSize;

  if ( NECKORIGINZ+diff[2] > bodylength+legLength ) {
    /* \xb8\xaa\xa4ΰ\xcc\xc3֤򲼤\xb2\xa4\xeb */
    diff[2] = bodylength+legLength-NECKORIGINZ;
  }

  return diff[2];
}

void
partsmotion::drawbody( vector3F neck, vector3F waist,
		       bool isWireFrame = false ) {
  glPushMatrix();
  glTranslatef( waist[0], waist[1], waist[2] );

  renderparts(2, isWireFrame);

  float rot = atan2( neck[1]-waist[1], neck[2]-waist[2] )-0.1;
  glRotatef( -rot*180.0F/3.14159265, 1.0, 0.0, 0.0 );

  for (int i = 0; i < 2 ; i++) {
    renderparts(i, isWireFrame);
  }
  glPopMatrix();
}


/***********************************************************************
 *	Class partsmotion
 ***********************************************************************/
partsmotion::partsmotion(const char *basename)
  : origin(NULL), qanim(NULL)
{
    const char *partnames[] = {
	"head", "chest", "hip", "racket",
	"Rshoulder", "Rarm", "Relbow", "Rforearm", "Rhand",
	"Rthigh"/*, "Rknee"*/, "Rshin"/*, "Rankle"*/, "Rfoot",
	"Lshoulder", "Larm", "Lelbow", "Lforearm", "Lhand",
	"Lthigh"/*, "Lknee"*/, "Lshin"/*, "Lankle"*/, "Lfoot" };

    qanim = new quaternionanim*[numParts];
    for ( int i = 0 ; i < numParts ; i++ ) {
	char anim[128];
        if ( i == 3 || i == 5 || i == 7 || i == 9 || i == 10 || i == 11 ||
	     i == 13 || i == 15 || i == 16 || i == 17 || i == 18 ||
	     i == 19 ) {
	    qanim[i] = NULL;
	} else {
	    snprintf( anim, sizeof(anim), "%s-%s.quaternion",
		      basename, partnames[i] );
	    qanim[i] = new quaternionanim(anim);
	}
    }

    char anim[128];
    snprintf(anim, sizeof(anim), "%s-center.affine", basename);
    origin = new affineanim(anim);
};

partsmotion::~partsmotion()
{
    if (qanim) {
	for (int i = 0; numParts > i; i++) {
	    if (qanim[i])
		delete qanim[i];
	}
	delete[] qanim;
    }
}

polyhedron **partsmotion::polyparts = NULL;
int partsmotion::numParts = 0;

bool partsmotion::loadmodel(const char *basename)
{
    const char *partnames[] = {
	"head", "chest", "hip", "racket",
	"Rshoulder", "Rarm", "Relbow", "Rforearm", "Rhand",
	"Rthigh"/*, "Rknee"*/, "Rshin"/*, "Rankle"*/, "Rfoot",
	"Lshoulder", "Larm", "Lelbow", "Lforearm", "Lhand",
	"Lthigh"/*, "Lknee"*/, "Lshin"/*, "Lankle"*/, "Lfoot" };

    numParts = sizeof(partnames) / sizeof(const char *);
    polyparts = new polyhedron*[numParts];

    for ( int i = 0 ; i < numParts ; i++ ) {
        char ref[128];
	snprintf(ref, sizeof(ref), "%s%s01.dat", basename, partnames[i]);
	polyparts[i] = new polyhedron(ref);
	polyparts[i]->getNormal();
    }
    if ( theRC->gmode == GMODE_TOON ) {
        initanimelight();
    }
    return true;
}

bool partsmotion::render(int frame, vector3F diff)
{
    return render( (double)frame, diff );
}

bool partsmotion::renderWire(int frame, vector3F diff)
{
    return renderWire( (double)frame, diff );
}

bool partsmotion::render(double _frame, vector3F diff)
{
    float frame = _frame;
    float zwaistdiff;

    if ( theRC->gmode == GMODE_TOON ) {
	affine4F t;
	glGetFloatv(GL_PROJECTION_MATRIX, (float*)&t);
	affine4F it = ~t;
	float _light[] = {1,1,-1};
	light = (vector3F(_light) ^ it).norm();

	glActiveTextureARB(GL_TEXTURE1_ARB);
	glEnable(GL_TEXTURE_1D);
	glTexEnvi(GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, GL_MODULATE);
	glBindTexture(GL_TEXTURE_1D, tex_animelight);
	glActiveTextureARB(GL_TEXTURE0_ARB);

	glDisable(GL_LIGHTING);
    }

    zwaistdiff = bodyIK( diff );

    glTranslatef( diff[0], diff[1], diff[2] );

    vector4F p;

    affine4F aff;
    vector4F pdum, qdum;

    pdum[0] = pdum[1] = pdum[2] = 0;
    pdum[3] = 1.0F;

    qdum[0] = 1.0F;
    qdum[1] = qdum[2] = qdum[3] = 0;

    glPushMatrix();
      aff = (*origin)[(int)frame];
      glMultMatrixf((float*)&aff);

      glPushMatrix();
        p[0] = qanim[1]->origin[0];
	p[1] = qanim[1]->origin[1];
	p[2] = qanim[1]->origin[2];
	p[3] = 1.0F;
	aff = Quaternion2Affine((*qanim[1])[frame], p);
	glMultMatrixf((float*)&aff);
	renderparts(1, false);					/* chest */
	glPushMatrix();
	  p[0] = qanim[0]->origin[0];
	  p[1] = qanim[0]->origin[1];
	  p[2] = qanim[0]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[0])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(0, false);				/* head */
	glPopMatrix();
	glPushMatrix();
          p[0] = qanim[4]->origin[0];
	  p[1] = qanim[4]->origin[1];
	  p[2] = qanim[4]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[4])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(4, false);				/* Rshoulder */
	  renderparts(5, false);				/* Rarm */

	  p[0] = qanim[6]->origin[0];
	  p[1] = qanim[6]->origin[1];
	  p[2] = qanim[6]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[6])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(6, false);				/* Relbow */
	  renderparts(7, false);				/* Rforearm */

	  p[0] = qanim[8]->origin[0];
	  p[1] = qanim[8]->origin[1];
	  p[2] = qanim[8]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[8])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(8, false);				/* Rhand */
	  renderparts(3, false);				/* racket */
        glPopMatrix();
	glPushMatrix();
          p[0] = qanim[12]->origin[0];
	  p[1] = qanim[12]->origin[1];
	  p[2] = qanim[12]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[12])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(12, false);				/* Lshoulder */
	  renderparts(13, false);				/* Larm */

	  p[0] = qanim[14]->origin[0];
	  p[1] = qanim[14]->origin[1];
	  p[2] = qanim[14]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[14])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(14, false);				/* Lelbow */
	  renderparts(15, false);				/* Lforearm */
	  renderparts(16, false);				/* Lhand */
        glPopMatrix();
      glPopMatrix();
      glPushMatrix();
        p[0] = qanim[2]->origin[0];
	p[1] = qanim[2]->origin[1];
	p[2] = qanim[2]->origin[2];
	p[3] = 1.0F;
	aff = Quaternion2Affine((*qanim[2])[frame], p);
	glMultMatrixf((float*)&aff);
	renderparts(2, false);					/* hip */

	/* Here, legs should be drawn */
	glTranslatef( 0.0, 0.159459, -1.010000-diff[2] );
	drawleg( diff[0], 0.0, zwaistdiff );

      glPopMatrix();
    glPopMatrix();

    if ( theRC->gmode == GMODE_TOON ) {
	glEnable(GL_LIGHTING);

	glActiveTextureARB(GL_TEXTURE1_ARB);
	glDisable(GL_TEXTURE_1D);
	glActiveTextureARB(GL_TEXTURE0_ARB);
    }

    return true;
}

bool partsmotion::renderWire(double _frame, vector3F diff)
{
    float frame = _frame;
    float zwaistdiff;

    zwaistdiff = bodyIK( diff );

    glTranslatef( diff[0], diff[1], diff[2] );

    vector4F p;

    affine4F aff;
    vector4F pdum, qdum;

    pdum[0] = pdum[1] = pdum[2] = 0;
    pdum[3] = 1.0F;

    qdum[0] = 1.0F;
    qdum[1] = qdum[2] = qdum[3] = 0;

    glPushMatrix();
      aff = (*origin)[(int)frame];
      glMultMatrixf((float*)&aff);

      glPushMatrix();
	p[0] = qanim[1]->origin[0];
	p[1] = qanim[1]->origin[1];
	p[2] = qanim[1]->origin[2];
	p[3] = 1.0F;
	aff = Quaternion2Affine((*qanim[1])[frame], p);
	glMultMatrixf((float*)&aff);
	renderparts(1, true);					/* chest */
	glPushMatrix();
	  p[0] = qanim[0]->origin[0];
	  p[1] = qanim[0]->origin[1];
	  p[2] = qanim[0]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[0])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(0, true);					/* head */
	glPopMatrix();
	glPushMatrix();
	  p[0] = qanim[4]->origin[0];
	  p[1] = qanim[4]->origin[1];
	  p[2] = qanim[4]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[4])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(4, true);					/* Rshoulder */
	  renderparts(5, true);					/* Rarm */

	  p[0] = qanim[6]->origin[0];
	  p[1] = qanim[6]->origin[1];
	  p[2] = qanim[6]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[6])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(6, true);					/* Relbow */
	  renderparts(7, true);					/* Relbow */

	  p[0] = qanim[8]->origin[0];
	  p[1] = qanim[8]->origin[1];
	  p[2] = qanim[8]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[8])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(8, true);					/* Rhand */
	  renderparts(3, true);					/* racket */
	glPopMatrix();
	glPushMatrix();
	  p[0] = qanim[12]->origin[0];
	  p[1] = qanim[12]->origin[1];
	  p[2] = qanim[12]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[12])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(12, true);				/* Lshoulder */
	  renderparts(13, true);				/* Larm */

	  p[0] = qanim[14]->origin[0];
	  p[1] = qanim[14]->origin[1];
	  p[2] = qanim[14]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[14])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(14, true);				/* Lelbow */
	  renderparts(15, true);				/* Lforearm */
	  renderparts(16, true);				/* Lhand */
	glPopMatrix();
      glPopMatrix();
      glPushMatrix();
	p[0] = qanim[2]->origin[0];
	p[1] = qanim[2]->origin[1];
	p[2] = qanim[2]->origin[2];
	p[3] = 1.0F;
	aff = Quaternion2Affine((*qanim[2])[frame], p);
	glMultMatrixf((float*)&aff);
	renderparts(2, true);					/* hip */

	/* Here, legs should be drawn */
	glTranslatef( 0.0, 0.159459, -1.010000-diff[2] );
	drawleg( diff[0], 0.0, zwaistdiff, true );

      glPopMatrix();
    glPopMatrix();

    return true;
}

bool partsmotion::renderArmOnly(double _frame, vector3F diff)
{
    float frame = _frame;
    float zwaistdiff;

    zwaistdiff = bodyIK( diff );

    glTranslatef( diff[0], diff[1], diff[2] );

    vector4F p;

    affine4F aff;
    vector4F pdum, qdum;

    pdum[0] = pdum[1] = pdum[2] = 0;
    pdum[3] = 1.0F;

    qdum[0] = 1.0F;
    qdum[1] = qdum[2] = qdum[3] = 0;

    glPushMatrix();
      aff = (*origin)[(int)frame];
      glMultMatrixf((float*)&aff);

      glPushMatrix();
	p[0] = qanim[1]->origin[0];
	p[1] = qanim[1]->origin[1];
	p[2] = qanim[1]->origin[2];
	p[3] = 1.0F;
	aff = Quaternion2Affine((*qanim[1])[frame], p);
	glMultMatrixf((float*)&aff);
	glPushMatrix();
	  p[0] = qanim[4]->origin[0];
	  p[1] = qanim[4]->origin[1];
	  p[2] = qanim[4]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[4])[frame], p);
	  glMultMatrixf((float*)&aff);

	  p[0] = qanim[6]->origin[0];
	  p[1] = qanim[6]->origin[1];
	  p[2] = qanim[6]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[6])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(6, true);					/* Relbow */
	  renderparts(7, true);					/* Rforearm */

	  p[0] = qanim[8]->origin[0];
	  p[1] = qanim[8]->origin[1];
	  p[2] = qanim[8]->origin[2];
	  p[3] = 1.0F;
	  aff = Quaternion2Affine((*qanim[8])[frame], p);
	  glMultMatrixf((float*)&aff);
	  renderparts(8, true);					/* Rhand */
	  renderparts(3, true);					/* racket */
	glPopMatrix();
      glPopMatrix();
    glPopMatrix();

    return true;
}

void
partsmotion::renderparts( int partsNum, bool isWireFrame ) {
#define c(R,G,B,A) { R/255.0F, G/255.0F, B/255.0F, A/255.0F}
  static GLfloat colors[][4] = {
//    { 0.4F, 0.4F, 0.4F, 1.0F},	// C0 default
    c(250, 188, 137, 127),		// C0 default(skin)
    c(1, 1, 1, 127),		// C1 eye
    c(42, 19, 5, 127), 		// C2 hair
    c(250, 188, 137, 127),		// C3 skin
//    c(225, 7, 47, 127),		// C4 shirts (red)
    c(3, 87, 125, 127),		// C4 shirts (blue)
//    c(2, 13, 24, 127),		// C5 pants  (green)
    c(0, 0, 0, 127),		// C5 pants  (black)
    c(102, 7, 3, 127),		// C6 skin/shadow
    c(255, 0, 0, 127),		// C7 racket/front
    c(0, 0, 0, 127),		// C8 racket/back

    {-1, -1, -1, -1}		// stop
  };
#undef c

  if (isWireFrame) {
    affine4F t;
    glGetFloatv(GL_MODELVIEW_MATRIX, (float*)&t);
    vector3F origin = vector3F(0) * ~t;

    glBegin(GL_LINES);
    for (int j = 0; polyparts[partsNum]->numEdges > j; j++) {
      int p0 = polyparts[partsNum]->edges[j].p0;
      int p1 = polyparts[partsNum]->edges[j].p1;
      bool draw = false;
      vector3F v = polyparts[partsNum]->points[polyparts[partsNum]->edges[j].v0] - origin;
      if (p1 >= 0) {
	Float i0 = v * polyparts[partsNum]->planeNormal[p0];
	Float i1 = v * polyparts[partsNum]->planeNormal[p1];
	if (i0 * i1 <= 0) draw = true;
      } else {
#if 0
	// Draw if the plane is facing toward eye.
	Float i0 = v * polyparts[partsNum]->planeNormal[p0];
	if (i0 <= 0) draw = true;
#else
	// always draw *edge* edges.
	draw = true;
#endif
      }

      if (draw) {
	vector3F v0 = polyparts[partsNum]->points[polyparts[partsNum]->edges[j].v0];// - v * 0.01F;
	vector3F v1 = polyparts[partsNum]->points[polyparts[partsNum]->edges[j].v1];// - v * 0.01F;
	glVertex3fv((float*)&v0);
	glVertex3fv((float*)&v1);
      }
    }
    glEnd();
  } else {
    for (int j = 0; polyparts[partsNum]->numPolygons > j; j++) {
      polygon poly = polyparts[partsNum]->getPolygon(j);
#if RENDEREDGE
      vector3F center(0);
#endif

      static GLfloat spc[] = { 0.0F, 0.0F, 0.0F, 0.0F };
      static GLfloat shininess[] = { 5.0 };
      glMaterialfv(GL_FRONT_AND_BACK, GL_SPECULAR, spc);
      glMaterialfv(GL_FRONT_AND_BACK, GL_DIFFUSE, colors[poly.c()]);
      glMaterialfv(GL_FRONT_AND_BACK, GL_AMBIENT, colors[poly.c()]);
      glMaterialfv(GL_FRONT, GL_SHININESS, shininess);

      glBegin(poly.glBeginSize());
      glColor4fv(colors[poly.c()]);

      for (int k = 0; poly.size > k; k++) {
	vector3F n = poly.rn(k);
	vector3F v = poly.rv(k);

	glNormal3fv((float*)&n);
	if ( theRC->gmode == GMODE_TOON ) {
	  glMultiTexCoord1fARB(GL_TEXTURE1_ARB, clamp(0.0f, light*n, 1.0f));
	}
#if RENDEREDGE
p	center += v;
#endif
	glVertex3fv((float*)&v);
      }
      glEnd();

#if RENDEREDGE
      // stop here if alpha blending is active
      if (glIsEnabled(GL_BLEND)) continue;

      center /= poly.size;
      bool culling = glIsEnabled(GL_CULL_FACE)>0;
      if (!culling) glEnable(GL_CULL_FACE);

      glBegin(poly.glBeginSize());
      glColor4fv(BLACK);

      for (int k = poly.size-1; 0 <= k; --k) {
	vector3F p = poly.rv(k);
	p -= center;
	Float l = p.len();
	p *= 1 + (0.01F/l);
	p += center;
	p -= poly.n() * 1e-8F;
	glVertex3fv((float*)&p);
      }
      glEnd();
      if (!culling) glDisable(GL_CULL_FACE);
#endif
    }
  }
}


// http://skal.planet-d.net/demo/matrixfaq.htm#Q46
vector4F
Affine2Quaternion(affine4F aff) {
  float t,s;
  vector4F v;

  t= aff[0][0] + aff[1][1] + aff[2][2] + 1.0f;

  if ( t > 0.0 ) {
    s = 0.5F/sqrtF(t);
    v[0] = 0.25F/s;
    v[1] = (aff[2][1] - aff[1][2])*s;
    v[2] = (aff[0][2] - aff[2][0])*s;
    v[3] = (aff[1][0] - aff[0][1])*s;
  } else if ( aff[0][0] >= aff[1][1] && aff[0][0] >= aff[2][2] ) {
    s = sqrtF(1.0 + aff[0][0] - aff[1][1] - aff[2][2])*2;
    v[0] = (aff[1][2] + aff[2][1])/s;
    v[1] = 0.5F/s;
    v[2] = (aff[0][1] + aff[1][0])/s;
    v[3] = (aff[0][2] + aff[2][0])/s;
  } else if ( aff[1][1] >= aff[0][0] && aff[1][1] >= aff[2][2] ) {
    s = sqrtF(1.0F + aff[1][1] - aff[0][0] - aff[2][2])*2;
    v[0] = (aff[0][2] + aff[2][0])/s;
    v[1] = (aff[0][1] + aff[1][0])/s;
    v[2] = 0.5F/s;
    v[3] = (aff[1][2] + aff[2][1])/s;
  } else {
    s = sqrtF(1.0F + aff[2][2] - aff[0][0] - aff[1][1])*2;
    v[0] = (aff[0][1] + aff[1][0])/s;
    v[1] = (aff[0][2] + aff[2][0])/s;
    v[2] = (aff[1][2] + aff[2][1])/s;
    v[3] = 0.5F/s;
  }

  return v;
}

// http://skal.planet-d.net/demo/matrixfaq.htm#Q47
affine4F
Quaternion2Affine(vector4F v, vector4F p) {
  affine4F ret;

  ret[0][0] = 1.0f - 2*(v[2]*v[2] + v[3]*v[3]);
  ret[0][1] =       2*(v[1]*v[2] - v[0]*v[3]);
  ret[0][2] =       2*(v[1]*v[3] + v[0]*v[2]);
  ret[1][0] =       2*(v[1]*v[2] + v[0]*v[3]);
  ret[1][1] = 1.0f - 2*(v[1]*v[1] + v[3]*v[3]);
  ret[1][2] =       2*(v[2]*v[3] - v[0]*v[1]);
  ret[2][0] =       2*(v[1]*v[3] - v[0]*v[2]);
  ret[2][1] =       2*(v[2]*v[3] + v[0]*v[1]);
  ret[2][2] = 1.0f - 2*(v[1]*v[1] + v[2]*v[2]);

  ret[3][0] = p[0];
  ret[3][1] = p[1];
  ret[3][2] = p[2];
  ret[3][3] = p[3];

  ret[0][3] = 0.0f;
  ret[1][3] = 0.0f;
  ret[2][3] = 0.0f;

  return ret;
}


#if 0
/***********************************************************************
 *	test
 ***********************************************************************/

int main(int argc, char *argv[])
{
    char ref[128], aff[128];
    snprintf(ref, sizeof(ref), "%s01.dat", argv[1]);
    snprintf(aff, sizeof(aff), "%s.affine", argv[1]);

    affinemotion pa(ref, aff);

    printf("load\n");
    pa.write(argv[2]);
    printf("write\n");
    return 0;
}
#endif

/***********************************************************************
 *	END OF parts.cpp
 ***********************************************************************/
