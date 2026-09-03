import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../models/festival_model.dart';
import '../../models/post_model.dart';
import '../../services/api_service.dart';
import '../../services/community_service.dart';
import '../../services/festival_service.dart';
import '../../theme/app_colors.dart';
import '../../config/app_config.dart';
import '../../utils/constants.dart';

/// 게시글 작성/수정 화면.
///
/// [post]가 있으면 수정, 없으면 작성이다.
/// 수정에서는 게시판을 바꿀 수 없다. 게시판마다 작성 권한과 축제 연결 정책이 달라
/// 이동을 허용하면 그 검증을 모두 다시 통과시켜야 하는데 실익보다 사고 위험이 크다. (서버도 동일)
class PostEditorScreen extends StatefulWidget {
  /// 수정할 글. null이면 새 글 작성.
  final PostModel? post;

  /// 작성 화면에서 미리 선택해 둘 게시판.
  final BoardCategoryModel? initialCategory;

  /// 축제 상세에서 "후기 쓰기"로 들어온 경우 고정할 축제.
  final int? fixedFestivalId;
  final String? fixedFestivalName;

  const PostEditorScreen({
    super.key,
    this.post,
    this.initialCategory,
    this.fixedFestivalId,
    this.fixedFestivalName,
  });

  @override
  State<PostEditorScreen> createState() => _PostEditorScreenState();
}

class _PostEditorScreenState extends State<PostEditorScreen> {
  final CommunityService _service = CommunityService();
  final FestivalService _festivalService = FestivalService();
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _titleController;
  late final TextEditingController _contentController;

  List<BoardCategoryModel> _categories = [];
  BoardCategoryModel? _selectedCategory;

  List<FestivalModel> _festivals = [];
  int? _selectedFestivalId;

  /// 첨부할 이미지. 수정 모드에서는 쓰지 않는다.
  final List<File> _images = [];

  bool _isLoading = true;
  bool _isSubmitting = false;

  /// 수정 모드인지 여부.
  bool get _isEditing => widget.post != null;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.post?.title ?? '');
    _contentController = TextEditingController(text: widget.post?.content ?? '');
    _selectedFestivalId = widget.fixedFestivalId ?? widget.post?.festival?.id;
    _loadCategories();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  /// 게시판 목록을 불러온다.
  ///
  /// 서버가 게시판별 정책(운영자 전용, 축제 필수)을 함께 주므로
  /// 앱은 그 값만 보고 화면을 구성한다. 게시판 코드를 앱에 하드코딩하지 않는다.
  Future<void> _loadCategories() async {
    try {
      final categories = await _service.fetchCategories();
      if (!mounted) return;

      setState(() {
        // 공지사항처럼 운영자만 쓸 수 있는 게시판은 선택지에서 뺀다.
        // 서버가 403으로 막지만, 고를 수 있게 두면 쓰고 나서야 거절당한다.
        _categories = categories.where((category) => !category.isAdminOnly).toList();

        _selectedCategory = _resolveInitialCategory();
        _isLoading = false;
      });

      await _loadFestivalsIfNeeded();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showMessage(error.message);
    }
  }

  /// 처음 선택되어 있을 게시판을 정한다.
  BoardCategoryModel? _resolveInitialCategory() {
    final targetCode = widget.post?.category?.code ?? widget.initialCategory?.code;

    for (final category in _categories) {
      if (category.code == targetCode) return category;
    }

    // 축제에서 들어왔다면 후기 게시판이 가장 자연스러운 기본값이다.
    if (widget.fixedFestivalId != null) {
      for (final category in _categories) {
        if (category.requireFestival) return category;
      }
    }

    return _categories.isNotEmpty ? _categories.first : null;
  }

  /// 축제를 선택해야 하는 게시판이면 축제 목록을 불러온다.
  ///
  /// 축제 상세에서 들어온 경우에는 축제가 이미 정해져 있으므로 부르지 않는다.
  Future<void> _loadFestivalsIfNeeded() async {
    if (widget.fixedFestivalId != null) return;
    if (_selectedCategory?.requireFestival != true) return;
    if (_festivals.isNotEmpty) return;

    try {
      final festivals = await _festivalService.fetchFestivals(limit: 100);
      if (!mounted) return;
      setState(() => _festivals = festivals);
    } on ApiException catch (error) {
      if (!mounted) return;
      _showMessage(error.message);
    }
  }

  /// 글을 저장한다. (작성 또는 수정)
  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedCategory == null) return;

    // 축제 필수 게시판인데 축제를 안 골랐으면 서버에 보내기 전에 막는다.
    if (_selectedCategory!.requireFestival && _selectedFestivalId == null) {
      _showMessage("'${_selectedCategory!.name}' 게시판은 축제를 선택해야 합니다.");
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      if (_isEditing) {
        await _service.updatePost(
          widget.post!.id,
          title: _titleController.text,
          content: _contentController.text,
        );
      } else {
        await _service.createPost(
          categoryCode: _selectedCategory!.code,
          title: _titleController.text,
          content: _contentController.text,
          festivalId: _selectedFestivalId,
          images: _images,
        );
      }

      if (!mounted) return;
      // 목록/상세가 스스로 새로고침할 수 있도록 성공 여부를 돌려준다.
      Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (!mounted) return;
      _showMessage(error.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  /// 갤러리에서 이미지를 고른다.
  ///
  /// 업로드 전에 크기를 줄인다. 요즘 휴대폰 사진은 한 장이 5MB를 넘기 쉬워
  /// 원본 그대로 보내면 서버의 용량 제한에 걸린다.
  Future<void> _pickImages() async {
    final remaining = AppConfig.maxPostImages - _images.length;
    if (remaining <= 0) {
      _showMessage('사진은 최대 ${AppConfig.maxPostImages}장까지 첨부할 수 있습니다.');
      return;
    }

    final picked = await ImagePicker().pickMultiImage(
      maxWidth: 1600,
      imageQuality: 85,
    );
    if (picked.isEmpty) return;

    // 서버도 개수를 막지만, 다 고르고 나서 거절당하는 것보다 여기서 자르는 편이 낫다.
    final accepted = picked.take(remaining).toList();

    setState(() => _images.addAll(accepted.map((file) => File(file.path))));

    if (picked.length > remaining) {
      _showMessage('사진은 최대 ${AppConfig.maxPostImages}장까지 첨부할 수 있습니다.');
    }
  }

  /// 첨부 이미지 선택 칸.
  Widget _buildImageField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const _FieldLabel(AppStrings.attachImages),
            const Spacer(),
            Text(
              '${_images.length} / ${AppConfig.maxPostImages}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
        SizedBox(
          height: 76,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              // 추가 버튼은 항상 맨 앞에 둔다. 사진이 늘어나도 위치가 바뀌지 않는다.
              _AddImageButton(onTap: _pickImages),
              for (var index = 0; index < _images.length; index += 1)
                _ImageThumbnail(
                  file: _images[index],
                  onRemove: () => setState(() => _images.removeAt(index)),
                ),
            ],
          ),
        ),
      ],
    );
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? AppStrings.editPost : AppStrings.writePost),
        actions: [
          Padding(
            padding: const EdgeInsets.fromLTRB(0, 8, AppSizes.paddingMedium, 8),
            child: FilledButton(
              onPressed: _isSubmitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.accent,
                disabledBackgroundColor: AppColors.line,
                padding: const EdgeInsets.symmetric(horizontal: 18),
                minimumSize: const Size(0, 34),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17)),
              ),
              child: Text(_isSubmitting ? '저장 중...' : '등록'),
            ),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(AppSizes.paddingMedium),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildCategoryField(),
                    const SizedBox(height: AppSizes.paddingMedium),
                    _buildFestivalField(),
                    const _FieldLabel(AppStrings.postTitleLabel),
                    TextFormField(
                      controller: _titleController,
                      maxLength: 200,
                      // 제목은 목록에서도 명조로 보이므로 입력할 때부터 같은 서체를 쓴다.
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontSize: 15),
                      decoration: const InputDecoration(),
                      // 서버와 같은 기준(2자 이상)으로 미리 막는다.
                      validator: (value) => (value ?? '').trim().length < 2
                          ? '제목은 2자 이상 입력해 주세요.'
                          : null,
                    ),
                    // 수정 모드에서는 첨부를 바꾸지 않는다.
                    // 서버가 수정 시 이미지 교체를 지원하지 않으므로 화면에도 두지 않는다.
                    if (!_isEditing) ...[
                      const SizedBox(height: AppSizes.paddingLarge),
                      _buildImageField(),
                    ],
                    const SizedBox(height: AppSizes.paddingLarge),
                    const _FieldLabel(AppStrings.postContentLabel),
                    TextFormField(
                      controller: _contentController,
                      maxLines: 12,
                      maxLength: 10000,
                      style: Theme.of(context).textTheme.bodyLarge,
                      decoration: const InputDecoration(alignLabelWithHint: true),
                      validator: (value) =>
                          (value ?? '').trim().isEmpty ? '내용을 입력해 주세요.' : null,
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  /// 게시판 선택 칸. 수정 모드에서는 읽기 전용으로 보여준다.
  Widget _buildCategoryField() {
    if (_isEditing) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _FieldLabel(AppStrings.boardSection),
          InputDecorator(
            decoration: const InputDecoration(),
            child: Text(widget.post?.category?.name ?? '-'),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _FieldLabel(AppStrings.boardSection),
        DropdownButtonFormField<BoardCategoryModel>(
      initialValue: _selectedCategory,
      decoration: const InputDecoration(),
      items: _categories
          .map((category) => DropdownMenuItem(value: category, child: Text(category.name)))
          .toList(),
      onChanged: (category) {
        setState(() {
          _selectedCategory = category;
          // 축제가 필요 없는 게시판으로 옮기면 선택했던 축제를 비운다.
          if (category?.requireFestival != true && widget.fixedFestivalId == null) {
            _selectedFestivalId = null;
          }
        });
        _loadFestivalsIfNeeded();
      },
        ),
        // 왜 공지사항이 목록에 없는지 알려준다. 없으면 버그로 오해한다.
        const _FieldHint('공지사항은 운영자만 작성할 수 있어 목록에 없습니다.'),
      ],
    );
  }

  /// 축제 선택 칸.
  ///
  /// 축제 연결이 필요 없는 게시판에서는 아예 보여주지 않는다.
  Widget _buildFestivalField() {
    final needsFestival = _selectedCategory?.requireFestival == true;
    if (!needsFestival && widget.fixedFestivalId == null) return const SizedBox.shrink();

    // 축제 상세에서 들어왔으면 대상이 이미 정해져 있으므로 고르게 하지 않는다.
    if (widget.fixedFestivalId != null) {
      return Padding(
        padding: const EdgeInsets.only(bottom: AppSizes.paddingLarge),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _FieldLabel(AppStrings.selectFestival, required: true),
            InputDecorator(
              decoration: const InputDecoration(),
              child: Row(
                children: [
                  const Icon(Icons.festival_outlined, size: 15, color: AppColors.accent),
                  const SizedBox(width: 8),
                  Text(widget.fixedFestivalName ?? '선택된 축제'),
                ],
              ),
            ),
          ],
        ),
      );
    }

    // 수정 모드에서는 축제를 바꾸지 않는다. (연결 해제가 서버에서 막히는 게시판이 있다)
    if (_isEditing) {
      return Padding(
        padding: const EdgeInsets.only(bottom: AppSizes.paddingLarge),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _FieldLabel(AppStrings.selectFestival),
            InputDecorator(
              decoration: const InputDecoration(),
              child: Text(widget.post?.festival?.name ?? '-'),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.paddingLarge),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _FieldLabel(AppStrings.selectFestival, required: true),
          DropdownButtonFormField<int>(
        initialValue: _selectedFestivalId,
        isExpanded: true,
        decoration: const InputDecoration(),
        items: _festivals
            .map((festival) => DropdownMenuItem(
                  value: festival.id,
                  child: Text(festival.name, overflow: TextOverflow.ellipsis),
                ))
            .toList(),
        onChanged: (id) => setState(() => _selectedFestivalId = id),
          ),
          const _FieldHint('이 게시판은 어떤 축제의 후기인지 선택해야 합니다.'),
        ],
      ),
    );
  }
}

/// 사진 추가 버튼.
class _AddImageButton extends StatelessWidget {
  final VoidCallback onTap;

  const _AddImageButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: AppSizes.paddingSmall),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.line),
            borderRadius: BorderRadius.circular(4),
          ),
          child: const Icon(Icons.add_photo_alternate_outlined, color: AppColors.inkMuted),
        ),
      ),
    );
  }
}

/// 선택한 사진 미리보기.
class _ImageThumbnail extends StatelessWidget {
  final File file;
  final VoidCallback onRemove;

  const _ImageThumbnail({required this.file, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: AppSizes.paddingSmall),
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Image.file(file, width: 72, height: 72, fit: BoxFit.cover),
          ),
          // 잘못 고른 사진을 뺄 방법이 없으면 처음부터 다시 해야 한다.
          Positioned(
            top: 2,
            right: 2,
            child: InkWell(
              onTap: onRemove,
              child: Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  color: AppColors.ink.withValues(alpha: 0.6),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close, size: 13, color: AppColors.surface),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 입력 칸 위에 붙는 작은 라벨.
///
/// Material의 floating label 대신 칸 밖에 두는 이유:
/// 값이 채워지면 label이 위로 올라가 크기가 바뀌는데, 폼이 길어질수록
/// 그 움직임이 산만하고 라벨끼리 세로 정렬도 흐트러진다.
class _FieldLabel extends StatelessWidget {
  final String text;

  /// 필수 입력 표시를 붙일지 여부.
  final bool required;

  const _FieldLabel(this.text, {this.required = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.paddingSmall),
      child: Row(
        children: [
          Text(text, style: Theme.of(context).textTheme.labelSmall),
          if (required) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.accentSurface,
                borderRadius: BorderRadius.circular(2),
              ),
              child: Text(
                '필수',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: AppColors.accent,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// 입력 칸 아래에 붙는 안내 문구.
class _FieldHint extends StatelessWidget {
  final String text;

  const _FieldHint(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Text(text, style: Theme.of(context).textTheme.bodySmall),
    );
  }
}
